import { MOD } from "../../core/constants.js";
import { dbgWarn } from "../../debug/logger.js";
import { FLAG_SCOPE, FLAG_KEY_REVEALED, FLAG_KEY_PERM_REVEALED, L, isGM, safeParse, resolveBaseActor, resolveActorFromKeys, isNpcPermanentlyRevealed } from "./reveal-state.js";
import { attachKeys, applyMaskedName, installObserver, ensureToggleButton, updateButtonIcon, updatePermRevealBadge, refreshByKeys, toggleRevealFromLi } from "./chat-masking.js";
import { forceRefreshCombatDock, refreshNativeCombatTracker, registerDockPatch, registerDockHooks, maskNativeCombatTracker, markRevealedInCombatTracker, addCombatTrackerToggleButtons } from "./combat-tracker.js";
import { applyTargetNameMasking, installTargetNameObserver } from "./target-masking.js";
// ---- Permanent Reveal Toggle ----
async function togglePermanentReveal(actor) {
    if (!actor)
        return;
    const base = resolveBaseActor(actor);
    if (!base)
        return;
    await base.setFlag(FLAG_SCOPE, FLAG_KEY_PERM_REVEALED, !isNpcPermanentlyRevealed(base));
    refreshByKeys(null);
    forceRefreshCombatDock();
    refreshNativeCombatTracker();
    try {
        game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: null });
        game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
        game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    }
    catch { /* ignore */ }
}
// ---- Context-Menu Helpers ----
function getActorFromDirEntry(el) {
    const id = el?.dataset?.documentId ?? el?.dataset?.entryId ?? el?.dataset?.actorId;
    return id ? game.actors?.get?.(id) ?? null : null;
}
function getActorFromCombatantEntry(el) {
    const combatant = game.combat?.combatants?.get?.(el?.dataset?.combatantId);
    return resolveBaseActor(combatant?.actor) ?? null;
}
function getActorFromChatEntry(el) {
    const keys = safeParse(el?.dataset?.bsrKeys || "[]", []);
    if (keys.length) {
        const a = resolveActorFromKeys(keys);
        if (a)
            return resolveBaseActor(a);
    }
    const messageId = el?.dataset?.messageId;
    if (messageId) {
        const msg = game.messages?.get?.(messageId);
        if (msg?.actor)
            return resolveBaseActor(msg.actor);
        if (msg?.speaker?.actor)
            return resolveBaseActor(game.actors?.get?.(msg.speaker.actor)) ?? null;
    }
    return null;
}
// ---- Context-Menus ----
Hooks.on("getActorContextOptions", (app, menuItems) => {
    menuItems.push({
        name: L("BSR.NPC.Action.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
        icon: '<i class="fa-solid fa-id-badge"></i>',
        condition: (el) => { if (!game.user?.isGM)
            return false; const a = getActorFromDirEntry(el); return a && a.type !== "character"; },
        callback: (el) => { const a = getActorFromDirEntry(el); if (a)
            togglePermanentReveal(a); }
    });
});
function bsrCombatTrackerContextHandler(_app, menuItems) {
    if (menuItems.some((e) => e._bsrPermReveal))
        return;
    menuItems.push({
        _bsrPermReveal: true,
        name: L("BSR.NPC.Action.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
        icon: '<i class="fa-solid fa-id-badge"></i>',
        condition: (el) => { if (!game.user?.isGM)
            return false; const a = getActorFromCombatantEntry(el); return a && a.type !== "character"; },
        callback: (el) => { const a = getActorFromCombatantEntry(el); if (a)
            togglePermanentReveal(a); }
    });
}
Hooks.on("getCombatTrackerContextOptions", bsrCombatTrackerContextHandler);
Hooks.on("getCombatantContextOptions", bsrCombatTrackerContextHandler);
Hooks.on("getChatMessageContextOptions", (app, menuItems) => {
    menuItems.push({
        name: L("BSR.NPC.Action.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
        icon: '<i class="fa-solid fa-id-badge"></i>',
        condition: (el) => { if (!game.user?.isGM)
            return false; const a = getActorFromChatEntry(el); return a && a.type !== "character"; },
        callback: (el) => { const a = getActorFromChatEntry(el); if (a)
            togglePermanentReveal(a); }
    });
});
// ---- Chat Message Rendering ----
function applyChatMasking(message, li) {
    try {
        applyTargetNameMasking(message, li);
        installTargetNameObserver(message, li);
        attachKeys(li, message);
        if (isGM())
            ensureToggleButton(li);
        applyMaskedName(message, li);
        installObserver(li);
        updateButtonIcon(li);
        updatePermRevealBadge(li);
    }
    catch (e) {
        dbgWarn("npc-reveal | chat masking failed", e);
    }
}
Hooks.on("renderChatMessageHTML", applyChatMasking);
Hooks.on("dnd5e.renderChatMessage", applyChatMasking);
// ---- Ready Hook: Click-Handler, Socket, Settings-Listener ----
Hooks.once("ready", () => {
    const chatRoot = (ui?.chat?.element || document);
    chatRoot.addEventListener?.("click", (ev) => {
        const a = ev.target?.closest?.("a.bsr-toggle-name");
        if (!a || !isGM())
            return;
        const li = a.closest?.(".chat-message");
        if (!li)
            return;
        ev.preventDefault();
        ev.stopPropagation();
        toggleRevealFromLi(li, { refreshCombatDock: forceRefreshCombatDock, refreshNativeCombatTracker });
    }, true);
    game.socket?.on?.(`module.${MOD}`, (payload) => {
        if (!payload || typeof payload !== "object")
            return;
        if (payload.op === "refreshByKeys") {
            refreshByKeys(payload.keys || null);
            return;
        }
        if (payload.op === "refreshCombatDock")
            forceRefreshCombatDock({ full: !!payload.full });
        if (payload.op === "refreshNativeTracker")
            refreshNativeCombatTracker();
    });
    Hooks.on("updateSetting", (setting) => {
        if (setting.key === `${MOD}.bsrNpcMaskDefault` || setting.key === `${MOD}.bsrNpcNameReplacement`) {
            setTimeout(() => { refreshByKeys(null); forceRefreshCombatDock(); refreshNativeCombatTracker(); }, 50);
        }
    });
    setTimeout(() => { refreshByKeys(null); forceRefreshCombatDock(); refreshNativeCombatTracker(); }, 50);
});
// ---- Token/Actor Update Hooks ----
Hooks.on("updateToken", (token, diff) => {
    try {
        const fs = diff?.flags?.[FLAG_SCOPE];
        if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_REVEALED)) {
            const tid = token.id;
            const keys = [`tid:${tid}`];
            if (token.parent?.id)
                keys.push(`t:Scene.${token.parent.id}.Token.${tid}`);
            refreshByKeys(keys);
            forceRefreshCombatDock();
            refreshNativeCombatTracker();
        }
    }
    catch { /* ignore */ }
});
Hooks.on("updateActor", (actor, diff) => {
    try {
        if (diff?.flags?.[FLAG_SCOPE] && Object.prototype.hasOwnProperty.call(diff.flags[FLAG_SCOPE], FLAG_KEY_PERM_REVEALED)) {
            refreshByKeys(null);
            forceRefreshCombatDock();
            refreshNativeCombatTracker();
        }
    }
    catch { /* ignore */ }
});
// ---- Native Combat Tracker Rendering ----
Hooks.on("renderCombatTracker", (_app, html) => {
    try {
        maskNativeCombatTracker(html);
    }
    catch (e) {
        dbgWarn("maskNativeCombatTracker failed", e);
    }
    try {
        markRevealedInCombatTracker(html);
    }
    catch (e) {
        dbgWarn("markRevealedInCombatTracker failed", e);
    }
    try {
        addCombatTrackerToggleButtons(html);
    }
    catch (e) {
        dbgWarn("addCombatTrackerToggleButtons failed", e);
    }
});
// ---- Dock Integration ----
registerDockPatch();
registerDockHooks();
