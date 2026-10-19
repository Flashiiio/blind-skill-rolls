import { getRollMetadata } from "../core/policy/roll-classification.js";

const RESULT_ATTRIBUTES = [
  "data-result", "data-total", "data-roll", "data-formula", "data-tooltip", "data-tooltip-html",
  "data-tooltip-text", "title", "aria-label", "popovertarget", "popovertargetaction"
];
const RESULT_CLASSES = ["success", "failure", "critical", "fumble"];

function clearResultState(element: Element): void {
  element.classList.remove(...RESULT_CLASSES);
  for (const attribute of RESULT_ATTRIBUTES) element.removeAttribute(attribute);
}

export function redactRollResults(html: HTMLElement, message?: unknown): void {
  const scope = html.querySelector<HTMLElement>(".message-content") ?? html;
  html.removeAttribute("data-result");
  const belongsToScope = (element: Element): boolean => {
    const linked = element.closest<HTMLElement>(".card-summary[data-message-id], .status[data-message-id]");
    return !linked || linked === scope || !game.messages.get(linked.dataset.messageId ?? "");
  };
  const elements = (selector: string): HTMLElement[] => Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(belongsToScope);

  if (scope.matches(".status[data-message-id]")) {
    clearResultState(scope);
    if (scope.textContent !== "??" || scope.childElementCount) scope.textContent = "??";
    return;
  }

  for (const total of elements(".dice-total, .dice-roll .total")) {
    clearResultState(total);
    if (total.textContent !== "??" || total.childElementCount) total.textContent = "??";
  }

  for (const element of elements([
    ".dice-formula", ".dice-tooltip", ".dice-tooltip-collapser", ".roll-breakdown",
    ".dice-roll .d20die", ".dice-roll > .icons", "damage-application"
  ].join(","))) element.remove();

  for (const roll of elements(".dice-roll")) {
    clearResultState(roll);
    roll.removeAttribute("data-action");
    if (roll.matches("button") && !roll.hasAttribute("disabled")) roll.setAttribute("disabled", "");
    const target = roll as HTMLElement & { popoverTargetElement?: Element | null };
    if ("popoverTargetElement" in target) target.popoverTargetElement = null;
    for (const child of Array.from(roll.querySelectorAll("*")).filter(belongsToScope)) clearResultState(child);
  }

  for (const inline of elements(".inline-result, .inline-roll")) {
    const replacement = document.createElement("span");
    replacement.textContent = "??";
    inline.replaceWith(replacement);
  }

  for (const pill of elements("target-pill")) {
    clearResultState(pill);
    for (const attribute of ["data-hit", "data-miss", "data-value"]) pill.removeAttribute(attribute);
    for (const indicator of pill.querySelectorAll(".pip")) indicator.remove();
  }

  const type = getRollMetadata(message).type;
  if (type === "save" || type === "death") {
    for (const result of elements([
      ".chat-card > .supplement", ".save-summary + .supplement", ".deltas",
      '[data-action="resistSave"]', '[data-forward-action="resistSave"]',
      '[data-action="breakConcentration"]', '[data-forward-action="breakConcentration"]'
    ].join(","))) result.remove();
  }
}
