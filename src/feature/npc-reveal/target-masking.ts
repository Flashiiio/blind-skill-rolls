import {
  clientShouldSeeRealName, docFromUuidSync, isNpcRevealed, maskLabel, shouldMaskByDefault
} from "./reveal-state.js";

interface TargetDescriptor {
  actor?: string;
  token?: string;
}

interface TargetMessage {
  system?: { targets?: TargetDescriptor[] };
  getAssociatedActor?: () => Actor | null | undefined;
  getAssociatedToken?: () => TokenDocument | null | undefined;
}

interface TargetIdentity {
  actor: Actor | null;
  token: TokenDocument | null;
}

interface NameState {
  original: string;
  rendered: string;
}

const textStates = new WeakMap<Element, NameState>();
const attributeStates = new WeakMap<Element, Map<string, NameState>>();
const observers = new WeakMap<HTMLElement, MutationObserver>();
const recordedTargetListeners = new WeakSet<Element>();

function identityFromUuid(uuid: string): TargetIdentity {
  const doc: FoundryDocument | null = docFromUuidSync(uuid);
  const token = doc?.documentName === "Token" ? doc as TokenDocument
    : doc?.parent?.documentName === "Token" ? doc.parent as TokenDocument : null;
  const actor = token?.actor ?? (doc?.documentName === "Actor" ? doc as Actor : null);
  return { actor, token };
}

function resolveTarget(uuid: string, message: TargetMessage): TargetIdentity {
  const identity = identityFromUuid(uuid);
  if (identity.token) return identity;
  const targets = message.system?.targets;
  const descriptors = Array.isArray(targets) ? targets.filter(target => target.token === uuid || target.actor === uuid) : [];
  const tokens = descriptors.flatMap(target => target.token ? [identityFromUuid(target.token)] : []).filter(target => target.token);
  if (tokens.length) return tokens.find(hideTarget) ?? tokens[0];
  return identity.actor ? identity : descriptors[0]?.actor ? identityFromUuid(descriptors[0].actor) : identity;
}

function hideTarget(identity: TargetIdentity): boolean {
  return !clientShouldSeeRealName() && shouldMaskByDefault(identity.actor)
    && !isNpcRevealed(identity.actor, identity.token);
}

function originalText(element: Element): string {
  const current = element.textContent ?? "";
  const previous = textStates.get(element);
  return previous?.rendered === current ? previous.original : current;
}

function writeText(element: Element, original: string, rendered: string): void {
  textStates.set(element, { original, rendered });
  if (element.textContent !== rendered) element.textContent = rendered;
}

function replaceNames(value: string, names: string[]): string {
  for (const name of new Set(names.filter(Boolean))) value = value.split(name).join(maskLabel());
  return value;
}

function maskAttributes(root: Element, hidden: boolean, names: string[], excludeDescendants?: string): void {
  const attributes = ["alt", "title", "aria-label", "data-tooltip", "data-tooltip-html"];
  const elements = [root, ...root.querySelectorAll(attributes.map(attribute => `[${attribute}]`).join(","))];
  for (const element of elements) {
    if (excludeDescendants && element.closest(excludeDescendants)) continue;
    for (const attribute of attributes) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;
      const states = attributeStates.get(element) ?? new Map<string, NameState>();
      const previous = states.get(attribute);
      const original = previous?.rendered === current ? previous.original : current;
      const rendered = hidden ? replaceNames(original, names) : original;
      states.set(attribute, { original, rendered });
      attributeStates.set(element, states);
      if (current !== rendered) element.setAttribute(attribute, rendered);
    }
  }
}

function maskTargetPill(pill: HTMLElement, message: TargetMessage): void {
  const options = Array.from(pill.querySelectorAll<HTMLOptionElement>("datalist > option[value]"));
  const targets = options.map(option => {
    const identity = resolveTarget(option.value, message);
    const original = originalText(option);
    const hidden = hideTarget(identity);
    const names = [original, identity.token?.name ?? "", identity.actor?.name ?? ""];
    writeText(option, original, hidden ? maskLabel() : original);
    maskAttributes(option, hidden, names);
    return { uuid: option.value, original, hidden, names };
  });
  const hidden = targets.some(target => target.hidden);
  const names = targets.flatMap(target => target.names);
  const label = pill.querySelector("label");
  if (label && targets.length) {
    const original = originalText(label);
    const masked = replaceNames(original, names);
    writeText(label, original, hidden ? (masked !== original ? masked : maskLabel()) : original);
  }
  maskAttributes(pill, hidden, names, ".target-pane, datalist");
  for (const entry of pill.querySelectorAll<HTMLElement>(".target-pane li[data-uuid]")) {
    const identity = resolveTarget(entry.dataset.uuid ?? "", message);
    const title = entry.querySelector(".title");
    if (!title) continue;
    let original = originalText(title);
    if (original === maskLabel()) original = targets.find(target => target.uuid === entry.dataset.uuid)?.original
      ?? identity.token?.name ?? identity.actor?.name ?? original;
    const entryHidden = hideTarget(identity);
    writeText(title, original, entryHidden ? maskLabel() : original);
    maskAttributes(entry, entryHidden, [original, identity.token?.name ?? "", identity.actor?.name ?? ""]);
  }
}

export function applyTargetNameMasking(message: unknown, root: HTMLElement): void {
  const source = (message ?? {}) as TargetMessage;
  const content = root.querySelector(".message-content");
  if (!content) return;
  for (const pill of content.querySelectorAll<HTMLElement>("target-pill")) maskTargetPill(pill, source);

  for (const summary of content.querySelectorAll<HTMLElement>(".card-summary")) {
    const linked = (game.messages?.get(summary.dataset.messageId ?? "") ?? {}) as TargetMessage;
    let identity = summary.dataset.targetUuid ? resolveTarget(summary.dataset.targetUuid, linked) : { token: null, actor: null };
    if (!identity.token && !identity.actor && summary.dataset.targetUuid) identity = resolveTarget(summary.dataset.targetUuid, source);
    if (!identity.token && !identity.actor) identity = { token: linked.getAssociatedToken?.() ?? null, actor: linked.getAssociatedActor?.() ?? null };
    for (const name of summary.querySelectorAll(".pill.target.transparent")) {
      const original = originalText(name);
      const hidden = hideTarget(identity);
      writeText(name, original, hidden ? maskLabel() : original);
      maskAttributes(name, hidden, [original, identity.token?.name ?? "", identity.actor?.name ?? ""]);
    }
  }

  for (const targets of content.querySelectorAll("recorded-targets")) {
    if (recordedTargetListeners.has(targets)) continue;
    targets.addEventListener("recorded-targets:build", () => applyTargetNameMasking(message, root));
    recordedTargetListeners.add(targets);
  }
}

export function installTargetNameObserver(message: unknown, root: HTMLElement): void {
  if (observers.has(root)) return;
  const observer = new MutationObserver(() => applyTargetNameMasking(message, root));
  observer.observe(root, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["alt", "title", "aria-label", "data-tooltip", "data-tooltip-html"]
  });
  observers.set(root, observer);
}

export function refreshTargetNames(): void {
  for (const root of document.querySelectorAll<HTMLElement>(".chat-message[data-message-id]")) {
    applyTargetNameMasking(game.messages?.get(root.dataset.messageId ?? ""), root);
  }
}
