import { MOD } from "../../core/constants.js";
import { dbgWarn } from "../../debug/logger.js";
import { refreshTargetNames } from "./target-masking.js";
import {
  FLAG_SCOPE, FLAG_KEY_REVEALED,
  maskLabel, L, isGM, uniq, safeParse,
  resolveActorFromKeys, resolveTokenFromKeys,
  isPureGMRoll, isRevealedForKeys, isNpcPermanentlyRevealed,
  clientShouldSeeRealName, docFromUuidSync
} from "./reveal-state.js";

// ---- Key-Attachment ----
export function attachKeys(li: HTMLElement, message: any): void {
  if (!li || !message) return;
  const keys: string[] = [];
  const speaker = message?.speaker ?? {};
  const actorDoc = message?.getAssociatedActor?.() ?? message?.speakerActor ?? message?.actor ?? null;
  const actorId = actorDoc?.id || speaker.actor || null;
  const actorName: string = actorDoc?.name || speaker.alias || "";
  const tokenId: string | null = speaker.token || null;
  const headerTarget = li.querySelector<HTMLElement>(".message-header [data-token-uuid], .message-header [data-actor-uuid], .message-header a.avatar[data-uuid]");
  const uuidFromHeader: string = headerTarget?.dataset.tokenUuid ?? headerTarget?.dataset.actorUuid ?? headerTarget?.dataset.uuid ?? "";
  const sceneId: string | null = speaker.scene ?? canvas?.scene?.id ?? null;
  const tokenUuid: string = message?.getAssociatedToken?.()?.uuid ?? ((tokenId && sceneId) ? `Scene.${sceneId}.Token.${tokenId}` : "");

  if (actorName) keys.push(`n:${actorName}`);
  if (actorId) keys.push(`aid:${actorId}`, `a:Actor.${actorId}`);
  if (tokenId) keys.push(`tid:${tokenId}`);
  if (tokenUuid) keys.push(`t:${tokenUuid}`);
  if (uuidFromHeader) keys.push(`u:${uuidFromHeader}`);
  if (keys.length) li.dataset.bsrKeys = JSON.stringify(uniq(keys));
}

// ---- DOM-Helpers ----
function findTitleNode(li: HTMLElement): HTMLElement | null {
  return li?.querySelector?.(".message-header .name-stacked .title")
    ?? li?.querySelector?.(".message-header .message-sender") ?? null;
}

function setTitle(li: HTMLElement, el: HTMLElement, value: string): void {
  try {
    if (!el || typeof value !== "string") return;
    const portraits = li.querySelectorAll(".message-header .avatar img, .message-header .avatar video");
    if (el.textContent === value && Array.from(portraits).every(portrait => portrait.getAttribute("alt") === value)) return;
    li.dataset.bsrGuard = "1";
    if (el.textContent !== value) el.textContent = value;
    portraits.forEach(portrait => portrait.setAttribute("alt", value));
    requestAnimationFrame(() => { delete li.dataset.bsrGuard; });
  } catch { /* ignore */ }
}

// ---- Masking ----
export function applyMaskedName(msg: any, li: HTMLElement): void {
  const titleEl = findTitleNode(li); if (!titleEl) return;
  const keys: string[] = safeParse(li.dataset.bsrKeys || "[]", []);

  if (isPureGMRoll(keys, msg)) {
    if (!li.dataset.bsrRealName) {
      const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
      if (real) li.dataset.bsrRealName = real;
    }
    setTitle(li, titleEl, li.dataset.bsrRealName || titleEl.textContent || "");
    li.removeAttribute("data-bsr-masked");
    return;
  }

  if (!keys.length) return;

  const actor = resolveActorFromKeys(keys);
  if (!li.dataset.bsrRealName) {
    const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
    if (real) li.dataset.bsrRealName = real;
  }

  if (actor?.type === "character") {
    setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
    li.removeAttribute("data-bsr-masked");
    return;
  }

  if (clientShouldSeeRealName()) {
    setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
    li.removeAttribute("data-bsr-masked");
    return;
  }

  const revealed = isRevealedForKeys(keys);
  if (revealed) {
    setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
    li.removeAttribute("data-bsr-masked");
  } else {
    setTitle(li, titleEl, maskLabel());
    li.setAttribute("data-bsr-masked", "1");
  }
}

// ---- Observer ----
export function installObserver(li: HTMLElement): void {
  if (!li || (li as any)._bsrNameObs) return;
  const header = li.querySelector?.(".message-header"); if (!header) return;
  const obs = new MutationObserver(() => {
    if (li.dataset.bsrGuard) return;
    applyMaskedName(game.messages?.get?.(li.dataset.messageId!), li);
    updateButtonIcon(li);
  });
  obs.observe(header, { subtree: true, childList: true, characterData: true });
  (li as any)._bsrNameObs = obs;
  const ro = new ResizeObserver(() => {
    if (!document.body.contains(li)) {
      try { obs.disconnect(); } catch { /* ignore */ }
      try { ro.disconnect(); } catch { /* ignore */ }
      delete (li as any)._bsrNameObs;
    }
  });
  ro.observe(header);
}

// ---- Toggle-Button ----
export function ensureToggleButton(li: HTMLElement): void {
  if (!isGM()) return;
  const keys: string[] = safeParse(li.dataset.bsrKeys || "[]", []);
  const msg = game.messages?.get?.(li.dataset.messageId!);
  if (isPureGMRoll(keys, msg)) return;
  const actor = resolveActorFromKeys(keys);
  if (actor?.type === "character") return;
  const headerMeta = li?.querySelector?.(".message-header .message-metadata"); if (!headerMeta) return;
  if (headerMeta.querySelector?.("a.bsr-toggle-name")) return;
  const a = document.createElement("a");
  a.className = "bsr-toggle-name bsr-meta-icon"; a.dataset.action = "bsr-toggle-name";
  const toggleLabel = L("BSR.NPC.Action.ToggleNameVisibility", "Toggle name visibility");
  a.setAttribute("aria-label", toggleLabel); a.setAttribute("title", toggleLabel);
  const i = document.createElement("i"); i.className = "fa-solid fa-id-badge fa-fw"; a.appendChild(i);
  headerMeta.insertBefore(a, headerMeta.firstChild);
}

// ---- Button-Icon ----
export function updateButtonIcon(li: HTMLElement): void {
  const btn = li?.querySelector?.("a.bsr-toggle-name i"); if (!btn) return;
  const keys: string[] = safeParse(li.dataset.bsrKeys || "[]", []);
  const revealed = isRevealedForKeys(keys);
  btn.className = revealed ? "fa-solid fa-user-secret fa-fw" : "fa-solid fa-id-badge fa-fw";
  const wrap = btn.closest("a.bsr-toggle-name");
  if (wrap) {
    const label = revealed ? L("BSR.NPC.Action.HideName", "Hide name") : L("BSR.NPC.Action.RevealName", "Reveal name");
    wrap.setAttribute("aria-label", label); wrap.setAttribute("title", label);
  }
}

// ---- Perm-Reveal-Badge ----
export function updatePermRevealBadge(li: HTMLElement): void {
  if (!isGM()) return;
  try { if (!game.settings.get(MOD, "bsrNpcMaskDefault")) { li?.querySelectorAll?.(".bsr-perm-badge")?.forEach(b => b.remove()); return; } } catch { return; }
  const keys: string[] = safeParse(li?.dataset?.bsrKeys || "[]", []);
  const actor = resolveActorFromKeys(keys);
  const existing = li?.querySelector?.(".message-header .bsr-perm-badge");
  if (actor && actor.type !== "character" && isNpcPermanentlyRevealed(actor)) {
    if (!existing) {
      const headerMeta = li?.querySelector?.(".message-header .message-metadata");
      if (headerMeta) {
        const badge = document.createElement("i");
        badge.className = "fa-solid fa-eye bsr-perm-badge bsr-meta-icon";
        badge.title = L("BSR.NPC.Label.PermRevealedIndicator", "Permanently revealed to players");
        badge.setAttribute("aria-label", badge.title);
        headerMeta.insertBefore(badge, headerMeta.firstChild);
      }
    }
  } else { if (existing) existing.remove(); }
}

// ---- Refresh ----
export function refreshByKeys(filterKeys: string[] | null = null): void {
  refreshTargetNames();
  const list = (ui?.chat?.element as HTMLElement | null)?.querySelector?.("ol.chat-log") || document.querySelector("ol.chat-log"); if (!list) return;
  list.querySelectorAll(".chat-message[data-message-id]").forEach(li => {
    const keys: string[] = safeParse((li as HTMLElement).dataset.bsrKeys || "[]", []);
    if (!keys.length) return;
    if (filterKeys && !keys.some(k => filterKeys.includes(k))) return;
    applyMaskedName(game.messages?.get?.((li as HTMLElement).dataset.messageId!), li as HTMLElement);
    updateButtonIcon(li as HTMLElement);
    updatePermRevealBadge(li as HTMLElement);
  });
}

// ---- Toggle Actions ----
interface RefreshCallbacks {
  refreshCombatDock: () => void;
  refreshNativeCombatTracker: () => void;
}

export async function toggleRevealFromLi(li: HTMLElement, { refreshCombatDock, refreshNativeCombatTracker }: RefreshCallbacks): Promise<void> {
  const keys: string[] = safeParse(li.dataset.bsrKeys || "[]", []);
  const token = resolveTokenFromKeys(keys); if (!token) return;
  await token.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, !token.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED));
  const tokenKeys = keys.filter(k => k.startsWith("tid:") || k.startsWith("t:"));
  const uKey = keys.find(k => k.startsWith("u:"));
  if (uKey) {
    const doc = docFromUuidSync(uKey.slice(2));
    if (doc?.documentName === "Token" || doc?.parent?.documentName === "Token") tokenKeys.push(uKey);
  }
  const refreshKeys = tokenKeys.length ? tokenKeys : keys;
  refreshByKeys(refreshKeys);
  refreshCombatDock();
  refreshNativeCombatTracker();
  try {
    game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: refreshKeys });
    game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
    game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
  } catch { /* ignore */ }
}
