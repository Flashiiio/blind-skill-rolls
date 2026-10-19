import { MOD } from "../../core/constants.js";
import { dbgWarn } from "../../debug/logger.js";
import { FLAG_SCOPE, FLAG_KEY_REVEALED, maskLabel, L, isGM, isNpcRevealed, isNpcPermanentlyRevealed, docFromUuidSync } from "./reveal-state.js";
import { refreshByKeys } from "./chat-masking.js";
// ---- Combat Tracker Dock ----
export function forceRefreshCombatDock({ full = false } = {}) {
    try {
        const dock = ui?.combatDock;
        if (!dock)
            return;
        const hasElement = !!dock.element || !!dock.rendered || !!document.querySelector("#combat-dock");
        if (full && hasElement && typeof dock.setupCombatants === "function") {
            try {
                dock.setupCombatants();
            }
            catch (e) {
                dbgWarn("dock.setupCombatants failed", e);
            }
        }
        if (typeof dock.updateCombatants === "function") {
            try {
                dock.updateCombatants();
            }
            catch (e) {
                dbgWarn("dock.updateCombatants failed", e);
            }
        }
        if (typeof dock.autosize === "function") {
            try {
                dock.autosize();
            }
            catch { /* ignore */ }
        }
        if (!hasElement && typeof dock.render === "function") {
            try {
                dock.render(true);
            }
            catch (e) {
                dbgWarn("dock.render failed", e);
            }
        }
    }
    catch (e) {
        dbgWarn("forceRefreshCombatDock failed", e);
    }
}
export function refreshNativeCombatTracker() {
    try {
        ui.combat?.render();
    }
    catch { /* ignore */ }
}
// ---- Combatant Helpers ----
function getCombatantTokenDoc(combatant) {
    try {
        if (combatant?.token?.documentName === "Token")
            return combatant.token;
    }
    catch { /* ignore */ }
    try {
        const sceneId = combatant?.sceneId || combatant?.combat?.scene?.id || canvas?.scene?.id;
        const tokenId = combatant?.tokenId || combatant?.token?.id;
        if (sceneId && tokenId)
            return docFromUuidSync(`Scene.${sceneId}.Token.${tokenId}`) ?? null;
    }
    catch { /* ignore */ }
    return null;
}
function isCombatantRevealed(combatant) {
    const tokenDoc = getCombatantTokenDoc(combatant);
    return isNpcRevealed(combatant?.actor ?? tokenDoc?.actor ?? null, tokenDoc);
}
function getCombatantRealName(combatant) {
    const tokenDoc = getCombatantTokenDoc(combatant);
    return tokenDoc?.name || combatant?.token?.name || combatant?.actor?.name || combatant?.name || maskLabel();
}
function getTrackerDisplayName(combatant) {
    if (!combatant)
        return maskLabel();
    if (game.user?.isGM)
        return getCombatantRealName(combatant);
    const tokenDoc = getCombatantTokenDoc(combatant);
    const actor = combatant?.actor ?? tokenDoc?.actor ?? null;
    if (actor?.type === "character")
        return getCombatantRealName(combatant);
    return isCombatantRevealed(combatant) ? getCombatantRealName(combatant) : maskLabel();
}
// ---- Dock Patching ----
const DOCK_MOD = "combat-tracker-dock";
export function registerDockPatch() {
    Hooks.once(`${DOCK_MOD}-init`, (api) => {
        try {
            const PortraitClass = api?.CombatantPortrait ?? CONFIG?.combatTrackerDock?.CombatantPortrait;
            if (!PortraitClass?.prototype)
                return;
            const descriptor = Object.getOwnPropertyDescriptor(PortraitClass.prototype, "name");
            if (!descriptor?.get || descriptor.get?._bsrPatched)
                return;
            const originalGetter = descriptor.get;
            const wrappedGetter = function () { try {
                originalGetter.call(this);
            }
            catch { /* ignore */ } return getTrackerDisplayName(this.combatant); };
            wrappedGetter._bsrPatched = true;
            Object.defineProperty(PortraitClass.prototype, "name", { get: wrappedGetter, configurable: true });
            forceRefreshCombatDock();
        }
        catch (e) {
            dbgWarn("failed to patch Combat Tracker Dock", e);
        }
    });
}
// ---- Dock-related Hooks ----
export function registerDockHooks() {
    Hooks.on("updateToken", (_scene, _token, diff) => {
        try {
            if (diff?.flags?.[FLAG_SCOPE] && Object.prototype.hasOwnProperty.call(diff.flags[FLAG_SCOPE], FLAG_KEY_REVEALED))
                forceRefreshCombatDock();
        }
        catch { /* ignore */ }
    });
    Hooks.on("updateCombatant", () => forceRefreshCombatDock());
    Hooks.on("createCombatant", () => forceRefreshCombatDock());
    Hooks.on("deleteCombatant", () => forceRefreshCombatDock());
    Hooks.on("renderCombatTracker", () => { setTimeout(() => forceRefreshCombatDock(), 0); });
}
// ---- Native Combat Tracker Masking ----
export function maskNativeCombatTracker(html) {
    if (!(html instanceof HTMLElement) || isGM())
        return;
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault"))
            return;
    }
    catch {
        return;
    }
    for (const entry of html.querySelectorAll(".combatant")) {
        const combatant = game.combat?.combatants?.get?.(entry.dataset?.combatantId);
        if (!combatant)
            continue;
        const actor = combatant.actor ?? null;
        if (actor?.type === "character")
            continue;
        if (!isNpcRevealed(actor, combatant.token ?? null)) {
            const label = maskLabel();
            const nameEl = entry.querySelector(".token-name > .name");
            if (nameEl)
                nameEl.textContent = label;
            entry.querySelector(".token-image")?.setAttribute("alt", label);
        }
    }
}
export function markRevealedInCombatTracker(html) {
    if (!(html instanceof HTMLElement) || !isGM())
        return;
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault"))
            return;
    }
    catch {
        return;
    }
    for (const entry of html.querySelectorAll(".combatant")) {
        entry.querySelectorAll(".bsr-perm-badge").forEach(b => b.remove());
        const combatant = game.combat?.combatants?.get?.(entry.dataset?.combatantId);
        if (!combatant)
            continue;
        const actor = combatant.actor ?? null;
        if (!actor || actor.type === "character")
            continue;
        if (isNpcPermanentlyRevealed(actor)) {
            const nameEl = entry.querySelector(".token-name > .name");
            if (nameEl && !nameEl.querySelector(".bsr-perm-badge")) {
                const badge = document.createElement("i");
                badge.className = "fa-solid fa-eye bsr-perm-badge";
                badge.title = L("BSR.NPC.Label.PermRevealedIndicator", "Permanently revealed to players");
                badge.setAttribute("aria-label", badge.title);
                nameEl.appendChild(badge);
            }
        }
    }
}
export function addCombatTrackerToggleButtons(html) {
    if (!(html instanceof HTMLElement) || !isGM())
        return;
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault"))
            return;
    }
    catch {
        return;
    }
    for (const entry of html.querySelectorAll(".combatant")) {
        entry.querySelectorAll(".bsr-ct-toggle").forEach(b => b.remove());
        const combatant = game.combat?.combatants?.get?.(entry.dataset?.combatantId);
        if (!combatant)
            continue;
        const actor = combatant.actor ?? null;
        if (!actor || actor.type === "character")
            continue;
        const tokenDoc = combatant.token ?? null;
        const revealed = isNpcRevealed(actor, tokenDoc);
        const btn = document.createElement("a");
        btn.className = "bsr-ct-toggle";
        btn.dataset.combatantId = entry.dataset.combatantId;
        const icon = document.createElement("i");
        icon.className = revealed ? "fa-solid fa-id-badge fa-fw" : "fa-solid fa-mask fa-fw";
        btn.appendChild(icon);
        const tooltip = revealed ? L("BSR.NPC.Action.HideName", "Hide name") : L("BSR.NPC.Action.RevealName", "Reveal name");
        btn.title = tooltip;
        btn.setAttribute("aria-label", tooltip);
        btn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); toggleRevealFromCombatant(entry); });
        entry.querySelector(".combatant-controls")?.prepend(btn);
    }
}
// ---- Toggle from Combatant ----
async function toggleRevealFromCombatant(entry) {
    const combatant = game.combat?.combatants?.get?.(entry?.dataset?.combatantId);
    if (!combatant)
        return;
    const tokenDoc = combatant.token ?? null;
    if (!tokenDoc)
        return;
    await tokenDoc.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, !tokenDoc.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED));
    const tid = tokenDoc.id;
    const sceneId = combatant.combat?.scene?.id ?? canvas?.scene?.id;
    const keys = [];
    if (tid)
        keys.push(`tid:${tid}`);
    if (sceneId && tid)
        keys.push(`t:Scene.${sceneId}.Token.${tid}`);
    const refreshKeys = keys.length ? keys : null;
    refreshByKeys(refreshKeys);
    forceRefreshCombatDock();
    refreshNativeCombatTracker();
    try {
        game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: refreshKeys });
        game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
        game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    }
    catch { /* ignore */ }
}
