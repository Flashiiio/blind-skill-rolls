import { MOD } from "../core/constants.js";
import { shouldHideForeignSecrets } from "../core/policy/chat-privacy.js";
import { getRollMetadata, isDeathSaveMessage } from "../core/policy/roll-classification.js";
import { dbgWarn, dbgDebug } from "../debug/logger.js";
import { installAudioPatches, registerAudioHooks } from "./audio-suppression.js";
import { redactRollResults } from "./chat-redaction.js";
const L = (k, fb) => { try {
    const t = game?.i18n?.localize?.(k);
    return (t && t !== k) ? t : (fb ?? k);
}
catch {
    return fb ?? k;
} };
const VISIBILITY_RECHECK_DELAY_MS = 200;
const POST_FRAME_ENFORCE_MS = 50;
const VISIBILITY_RETRY_DELAY_MS = 600;
const meId = () => game.user?.id ?? null;
const whisperIds = (m) => Array.isArray(m?.whisper) ? m.whisper
    : Array.isArray(m?.whisperRecipients) ? m.whisperRecipients.map((u) => u?.id ?? u?._id).filter(Boolean)
        : [];
const isSecret = (m) => !!m?.blind || (Array.isArray(m?.whisper) && m.whisper.length > 0);
const isBsrBlind = (m) => {
    if (m?.blind)
        return true;
    try {
        return !!m?.flags?.['blind-skill-rolls']?.bsrBlind;
    }
    catch {
        return false;
    }
};
const isBsrPrivate = (m) => {
    try {
        return !!m?.flags?.['blind-skill-rolls']?.bsrPrivate;
    }
    catch {
        return false;
    }
};
const isBsrSecret = (m) => isBsrBlind(m) || isBsrPrivate(m);
const isRevealedToCurrentUser = (m) => {
    if (game.user?.isGM)
        return false;
    const me = String(game.user?.id ?? "");
    const author = String(m?.author?.id ?? m?.author ?? "");
    if (!me || author !== me)
        return false;
    try {
        return !!m?.getFlag?.(MOD, "revealedToRoller");
    }
    catch {
        return false;
    }
};
function readChangedValue(changed, path) {
    if (changed && typeof changed === "object" && path in changed)
        return changed[path];
    let cursor = changed;
    for (const part of path.split(".")) {
        if (!cursor || typeof cursor !== "object" || !(part in cursor))
            return undefined;
        cursor = cursor[part];
    }
    return cursor;
}
function isPublicRevealUpdate(message, changed) {
    if (!isBsrSecret(message))
        return false;
    if (!isSecret(message))
        return false;
    const nextBlind = readChangedValue(changed, "blind");
    const nextWhisper = readChangedValue(changed, "whisper");
    if (nextBlind === undefined && nextWhisper === undefined)
        return false;
    const effectiveBlind = nextBlind === undefined ? !!message?.blind : nextBlind === true;
    const effectiveWhisper = Array.isArray(nextWhisper) ? nextWhisper : whisperIds(message);
    return effectiveBlind === false && Array.isArray(effectiveWhisper) && effectiveWhisper.length === 0;
}
function clearBsrSecretFlags(changed) {
    changed.flags ??= {};
    changed.flags[MOD] = { ...(changed.flags[MOD] ?? {}), bsrBlind: false, bsrPrivate: false, revealedToRoller: false };
}
function applyClientSecretClasses(el, message) {
    const revealedToMe = isBsrBlind(message) && isRevealedToCurrentUser(message);
    if (revealedToMe) {
        el.classList.remove("hidden_msg");
        el.classList.remove("blind");
        el.classList.add("whisper");
        return;
    }
    if (isBsrBlind(message) && !message?.blind && !el.classList.contains("blind")) {
        el.classList.remove("whisper");
        el.classList.add("blind");
    }
    if (isBsrPrivate(message) && !el.classList.contains("whisper")) {
        el.classList.remove("blind");
        el.classList.add("whisper");
    }
}
function isAddressedToMe(m) {
    const me = meId();
    if (!me)
        return false;
    if (!isSecret(m))
        return true;
    const author = m?.author?.id ?? m?.author;
    if (String(author) === String(me))
        return true;
    return whisperIds(m).map(String).includes(String(me));
}
const isGmAuthor = (m) => {
    const a = m?.author;
    return !!a && (a.isGM || (a.role ?? 0) >= CONST.USER_ROLES.ASSISTANT);
};
function shouldHideForMe(m) {
    if (game.user.isGM)
        return false;
    const bsrSecret = isBsrSecret(m);
    if (!isSecret(m) && !bsrSecret)
        return false;
    if (isGmAuthor(m)) {
        if (bsrSecret)
            return true;
        return !isAddressedToMe(m);
    }
    if (isBsrBlind(m) && !isAddressedToMe(m))
        return true;
    if (isAddressedToMe(m))
        return false;
    return shouldHideForeignSecrets();
}
// ---- ChatMessage.visible override ----
let _visibilityPatched = false;
function patchMessageVisibility() {
    if (_visibilityPatched)
        return;
    try {
        const proto = ChatMessage.prototype;
        if (!proto)
            return;
        let target = proto;
        let desc;
        while (target && !desc) {
            desc = Object.getOwnPropertyDescriptor(target, 'visible');
            if (!desc)
                target = Object.getPrototypeOf(target);
        }
        if (!desc?.get || !target) {
            dbgWarn("chat-visibility | ChatMessage.visible getter not found – foreign-secret override skipped");
            return;
        }
        const origGet = desc.get;
        Object.defineProperty(target, 'visible', {
            get() {
                const orig = origGet.call(this);
                if (orig)
                    return true;
                if (!game.user?.isGM) {
                    if (this.blind) {
                        if (isGmAuthor(this))
                            return false;
                        const isAuthor = String(this.author?.id ?? '') === String(game.user?.id ?? '');
                        return isAuthor;
                    }
                    if (!shouldHideForeignSecrets() && Array.isArray(this.whisper) && this.whisper.length > 0) {
                        if (isGmAuthor(this))
                            return false;
                        return true;
                    }
                }
                return false;
            },
            configurable: true,
            enumerable: desc.enumerable ?? true
        });
        _visibilityPatched = true;
        dbgDebug("chat-visibility | patched ChatMessage.visible for foreign-secret override");
        // ---- isContentVisible override for Reveal-to-Roller ----
        patchIsContentVisible(proto);
    }
    catch (e) {
        dbgWarn("chat-visibility | failed to patch ChatMessage.visible", e);
    }
}
function patchIsContentVisible(proto) {
    try {
        let contentTarget = proto;
        let contentDesc;
        while (contentTarget && !contentDesc) {
            contentDesc = Object.getOwnPropertyDescriptor(contentTarget, 'isContentVisible');
            if (!contentDesc)
                contentTarget = Object.getPrototypeOf(contentTarget);
        }
        if (!contentDesc?.get || !contentTarget) {
            dbgWarn("chat-visibility | ChatMessage.isContentVisible getter not found – reveal-to-roller content override skipped");
            return;
        }
        const origContentGet = contentDesc.get;
        Object.defineProperty(contentTarget, 'isContentVisible', {
            get() {
                const orig = origContentGet.call(this);
                if (orig)
                    return true;
                if (this.blind && !game.user?.isGM) {
                    const meStr = String(game.user?.id ?? '');
                    const authorStr = String(this.author?.id ?? this.author ?? '');
                    if (meStr && authorStr === meStr) {
                        try {
                            if (this.getFlag?.(MOD, "revealedToRoller"))
                                return true;
                        }
                        catch { /* ignore */ }
                    }
                }
                return false;
            },
            configurable: true,
            enumerable: contentDesc.enumerable ?? true
        });
        dbgDebug("chat-visibility | patched ChatMessage.isContentVisible for reveal-to-roller");
    }
    catch (e) {
        dbgWarn("chat-visibility | failed to patch ChatMessage.isContentVisible", e);
    }
}
// ---- Instance-level visible override (belt-and-suspenders) ----
function ensureInstanceVisible(doc) {
    try {
        if (doc.__bsrVisible)
            return;
        Object.defineProperty(doc, 'visible', {
            get() {
                if (game.user?.isGM)
                    return true;
                if (!isSecret(this))
                    return true;
                const meStr = String(game.user?.id ?? '');
                const authorStr = String(this.author?.id ?? this.author ?? '');
                if (authorStr === meStr)
                    return true;
                if (this.blind)
                    return false;
                if (whisperIds(this).map(String).includes(meStr))
                    return true;
                if (isGmAuthor(this))
                    return false;
                return !shouldHideForeignSecrets();
            },
            configurable: true,
            enumerable: true
        });
        doc.__bsrVisible = true;
    }
    catch { /* ignore */ }
}
// ---- CSS-Guard ----
function ensureGlobalStyle() {
    if (document.getElementById("bsr-chat-css"))
        return;
    const css = `
    html[data-bsr-hide="1"] li.chat-message.whisper,
    html[data-bsr-hide="1"] li.chat-message.blind { display: none !important; }
    html[data-bsr-hide="1"] li.chat-message.blind[data-bsr-visible="1"],
    html[data-bsr-hide="1"] li.chat-message.whisper[data-bsr-visible="1"],
    html[data-bsr-hide="1"] li.chat-message[data-bsr-visible="1"] { display: flex !important; }
  `.trim();
    const style = document.createElement("style");
    style.id = "bsr-chat-css";
    style.textContent = css;
    document.head.appendChild(style);
}
function applyCssGuard() {
    if (!game?.user)
        return;
    const on = !game.user.isGM;
    if (on)
        document.documentElement.setAttribute("data-bsr-hide", "1");
    else
        document.documentElement.removeAttribute("data-bsr-hide");
}
// ---- DOM roots ----
const getSidebarRoot = () => {
    const el = ui?.chat?.element;
    if (!(el instanceof HTMLElement))
        return null;
    return el.querySelector("ol.chat-log, .chat-log") ?? el;
};
function popoutLogs() {
    const out = [];
    for (const w of Object.values(ui.windows ?? {})) {
        if (!w || w.constructor?.name !== "ChatPopout")
            continue;
        const cont = w.element instanceof HTMLElement ? w.element.querySelector(".window-content") : null;
        const log = cont?.querySelector?.("ol.chat-log, .chat-log") ?? cont;
        if (log)
            out.push(log);
    }
    return out;
}
const allRoots = () => [getSidebarRoot(), ...popoutLogs()].filter(Boolean);
// ---- Visibility marking ----
function markVisibility(li, msg) {
    try {
        applyClientSecretClasses(li, msg);
        if (shouldHideForMe(msg)) {
            li.removeAttribute("data-bsr-visible");
            li.style.setProperty('display', 'none', 'important');
        }
        else {
            li.setAttribute("data-bsr-visible", "1");
            if ((isSecret(msg) || isBsrSecret(msg)) && !li.classList.contains('hidden_msg')) {
                li.style.setProperty('display', 'flex', 'important');
            }
            else if (!li.classList.contains('hidden_msg')) {
                li.style.removeProperty('display');
            }
        }
    }
    catch { /* ignore */ }
}
function sweepRoot(root) {
    if (!root)
        return;
    for (const li of root.querySelectorAll("li.chat-message")) {
        const id = li.dataset?.messageId;
        if (!id) {
            if (li.classList.contains("whisper") || li.classList.contains("blind"))
                li.removeAttribute("data-bsr-visible");
            continue;
        }
        const msg = game.messages?.get?.(id);
        if (!msg) {
            if (li.classList.contains("whisper") || li.classList.contains("blind"))
                li.removeAttribute("data-bsr-visible");
            continue;
        }
        markVisibility(li, msg);
    }
}
const sweepAllRoots = () => allRoots().forEach(sweepRoot);
// ---- Deferred sweep ----
let _sweepScheduled = false;
let _sweepGlobal = false;
let _sweepRoot = null;
function deferredSweep(root) {
    if (!root)
        _sweepGlobal = true;
    else if (!_sweepGlobal && !_sweepRoot)
        _sweepRoot = root;
    else if (!_sweepGlobal)
        _sweepGlobal = true;
    if (_sweepScheduled)
        return;
    _sweepScheduled = true;
    requestAnimationFrame(() => {
        const doGlobal = _sweepGlobal;
        const targetRoot = _sweepRoot;
        _sweepScheduled = false;
        _sweepGlobal = false;
        _sweepRoot = null;
        if (doGlobal)
            sweepAllRoots();
        else if (targetRoot)
            sweepRoot(targetRoot);
    });
}
// ---- Shared observer callback ----
function onChatNodesAdded(mutations) {
    for (const mut of mutations)
        for (const n of mut.addedNodes) {
            if (!(n instanceof HTMLElement))
                continue;
            if (n.matches?.("li.chat-message")) {
                const id = n.dataset?.messageId;
                const msg = id ? game.messages?.get?.(id) : null;
                msg ? markVisibility(n, msg) : n.removeAttribute("data-bsr-visible");
                continue;
            }
            for (const li of (n.querySelectorAll?.("li.chat-message") ?? [])) {
                const id = li.dataset?.messageId;
                const msg = id ? game.messages?.get?.(id) : null;
                msg ? markVisibility(li, msg) : li.removeAttribute("data-bsr-visible");
            }
        }
}
function createChatObserver(root) {
    const obs = new MutationObserver(onChatNodesAdded);
    obs.observe(root, { childList: true, subtree: true });
    deferredSweep(root);
    return obs;
}
// ---- Sidebar observer ----
let sidebarObserver = null;
function observeSidebar() {
    if (sidebarObserver)
        sidebarObserver.disconnect();
    const root = getSidebarRoot();
    if (!root)
        return;
    sidebarObserver = createChatObserver(root);
}
// ---- Popout observers ----
const popoutObservers = new WeakMap();
Hooks.on("renderChatPopout", (_app, html) => {
    if (game.user.isGM)
        return;
    const root = html instanceof HTMLElement ? html : null;
    if (!root)
        return;
    const logEl = root.querySelector?.("ol.chat-log") ?? root.querySelector?.(".chat-log") ?? root;
    const prev = popoutObservers.get(logEl);
    if (prev)
        try {
            prev.disconnect();
        }
        catch { /* ignore */ }
    popoutObservers.set(logEl, createChatObserver(logEl));
});
Hooks.on("closeChatPopout", (_app, html) => {
    try {
        const root = html instanceof HTMLElement ? html : null;
        const logEl = root?.querySelector?.("ol.chat-log") ?? root?.querySelector?.(".chat-log") ?? root;
        if (!logEl)
            return;
        const obs = popoutObservers.get(logEl);
        if (obs)
            obs.disconnect();
        popoutObservers.delete(logEl);
    }
    catch { /* ignore */ }
});
// ---- Blind-Roller-Chat-Masking classification ----
function isSavingThrowMessage(message) {
    try {
        const bsrKind = message?.flags?.[MOD]?.rollKind ?? message?.getFlag?.(MOD, "rollKind");
        if (bsrKind === "save")
            return true;
        if (bsrKind === "abilityCheck" || bsrKind === "skill")
            return false;
        const { type: rollType, ability, skill, tool } = getRollMetadata(message);
        const isDeath = isDeathSaveMessage(message);
        if (isDeath || skill || tool)
            return false;
        return rollType === "save" || (!!ability && !rollType);
    }
    catch {
        return false;
    }
}
function isAbilityCheckMessage(message) {
    try {
        const bsrKind = message?.flags?.[MOD]?.rollKind ?? message?.getFlag?.(MOD, "rollKind");
        if (bsrKind === "abilityCheck")
            return true;
        if (bsrKind === "save" || bsrKind === "skill")
            return false;
        const { type: rollType, ability, skill, tool } = getRollMetadata(message);
        const isDeath = isDeathSaveMessage(message);
        if (isDeath || skill || tool)
            return false;
        return rollType === "ability" || rollType === "check" || (!!ability && !rollType);
    }
    catch {
        return false;
    }
}
function shouldHideBlindRollerCard(message) {
    if (game.user?.isGM || message.author?.id !== game.user?.id || !isBsrBlind(message) || isRevealedToCurrentUser(message))
        return false;
    const setting = isDeathSaveMessage(message) ? "blindRollersDeathSaveChat"
        : isSavingThrowMessage(message) ? "blindRollersSaveChat"
            : isAbilityCheckMessage(message) ? "blindRollersAbilityChat" : "blindRollersChat";
    return game.settings.get(MOD, setting) === true;
}
function shouldRedactResults(message) {
    if (game.user?.isGM || isRevealedToCurrentUser(message))
        return false;
    if (isBsrBlind(message))
        return true;
    if (isBsrPrivate(message))
        return message.author?.id !== game.user?.id;
    return isSecret(message) && !isAddressedToMe(message);
}
const hiddenLinkedDisplays = new WeakMap();
function applyLinkedResultPrivacy(html) {
    if (game.user?.isGM)
        return;
    for (const result of html.querySelectorAll(".card-summary[data-message-id], .status[data-message-id]")) {
        const message = game.messages.get(result.dataset.messageId ?? "");
        if (!message)
            continue;
        if (shouldHideForMe(message) || shouldHideBlindRollerCard(message)) {
            if (!hiddenLinkedDisplays.has(result))
                hiddenLinkedDisplays.set(result, result.style.getPropertyValue("display"));
            result.style.setProperty("display", "none", "important");
        }
        else if (hiddenLinkedDisplays.has(result)) {
            const previous = hiddenLinkedDisplays.get(result);
            if (previous)
                result.style.setProperty("display", previous);
            else
                result.style.removeProperty("display");
            hiddenLinkedDisplays.delete(result);
        }
        if (shouldRedactResults(message))
            redactRollResults(result, message);
    }
}
function refreshLinkedResultCards(message, changed) {
    const bsrPath = `flags.${MOD}`;
    const privacyChanged = readChangedValue(changed, "blind") !== undefined || readChangedValue(changed, "whisper") !== undefined
        || readChangedValue(changed, bsrPath) !== undefined
        || (!!changed && typeof changed === "object" && Object.keys(changed).some(key => key.startsWith(`${bsrPath}.`)));
    if (!privacyChanged)
        return;
    const parents = new Map();
    for (const result of document.querySelectorAll(".card-summary[data-message-id], .status[data-message-id]")) {
        if (result.dataset.messageId !== message.id)
            continue;
        const root = result.closest(".chat-message[data-message-id]");
        const parent = root?.dataset.messageId ? game.messages.get(root.dataset.messageId) : null;
        if (!root || !parent || parent.id === message.id)
            continue;
        applyLinkedResultPrivacy(root);
        parents.set(parent.id, parent);
    }
    for (const parent of parents.values()) {
        void ui.chat?.updateMessage?.(parent).catch(error => dbgWarn("chat-visibility | linked card refresh", error));
    }
}
// ---- Consolidated renderChatMessageHTML handler ----
let _hiddenLabelText = "";
Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
        if (!html)
            return;
        applyLinkedResultPrivacy(html);
        const isGM = !!game.user?.isGM;
        const isAuthor = !isGM && String(message.author?.id ?? '') === String(game.user?.id ?? '');
        const blind = isBsrBlind(message);
        const private_ = isBsrPrivate(message);
        const secret = blind || private_;
        const revealedToMe = blind && isRevealedToCurrentUser(message);
        applyClientSecretClasses(html, message);
        if (!isGM) {
            const hide = shouldHideForMe(message);
            if (hide) {
                html.removeAttribute("data-bsr-visible");
                html.style.setProperty('display', 'none', 'important');
            }
            else {
                html.setAttribute("data-bsr-visible", "1");
                if ((isSecret(message) || secret) && !isAuthor) {
                    html.style.setProperty('display', 'flex', 'important');
                }
            }
        }
        if (isGM && html.classList?.contains("hidden_msg")) {
            html.setAttribute("data-bsr-hidden-label", _hiddenLabelText);
        }
        if (!isGM && blind) {
            const isRoller = message.author?.id === game.user?.id;
            if (isRoller) {
                const revealedToRoller = revealedToMe;
                const isSave = isSavingThrowMessage(message);
                const isAbilityCheck = isAbilityCheckMessage(message);
                const isDeath = isDeathSaveMessage(message);
                if (isSave && game.settings.get(MOD, "blindRollersSaveChat") && !revealedToRoller)
                    html.classList.add("hidden_msg");
                else if (isAbilityCheck && game.settings.get(MOD, "blindRollersAbilityChat") && !revealedToRoller)
                    html.classList.add("hidden_msg");
                else if (!isSave && !isAbilityCheck && !isDeath && game.settings.get(MOD, "blindRollersChat") && !revealedToRoller)
                    html.classList.add("hidden_msg");
                else if (isDeath && game.settings.get(MOD, "blindRollersDeathSaveChat") && !revealedToRoller)
                    html.classList.add("hidden_msg");
            }
        }
        if (!isGM && secret && !html.classList.contains("hidden_msg")) {
            if (isAuthor) {
                html.style.setProperty('display', 'flex', 'important');
            }
        }
        if (!isGM && secret && !html.classList.contains("hidden_msg")) {
            const rollerSkipsRedaction = private_ && isAuthor;
            const revealed = isAuthor && message.getFlag?.(MOD, "revealedToRoller");
            if (!revealed && !rollerSkipsRedaction) {
                redactRollResults(html, message);
            }
        }
    }
    catch (e) {
        dbgWarn("chat-visibility | renderChatMessageHTML", e);
    }
});
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
    try {
        if (!html || game.user?.isGM)
            return;
        applyLinkedResultPrivacy(html);
        const blind = isBsrBlind(message);
        const private_ = isBsrPrivate(message);
        if (!blind && !private_)
            return;
        if (html.classList?.contains("hidden_msg"))
            return;
        applyClientSecretClasses(html, message);
        if (!shouldHideForMe(message)) {
            html.setAttribute("data-bsr-visible", "1");
            if (!html.classList.contains('hidden_msg')) {
                html.style.setProperty('display', 'flex', 'important');
            }
        }
        const isAuthor = String(message.author?.id ?? '') === String(game.user?.id ?? '');
        const revealed = isAuthor && message.getFlag?.(MOD, "revealedToRoller");
        if (revealed)
            return;
        if (private_ && isAuthor)
            return;
        redactRollResults(html, message);
    }
    catch (e) {
        dbgWarn("chat-visibility | dnd5e.renderChatMessage redaction", e);
    }
});
Hooks.on("createChatMessage", (doc) => {
    try {
        if (game.user?.isGM)
            return;
        const secret = doc?.blind || (Array.isArray(doc?.whisper) && doc.whisper.length > 0);
        const blind = isBsrBlind(doc);
        const private_ = isBsrPrivate(doc);
        const bsrManaged = blind || private_;
        if (secret || bsrManaged) {
            if (secret && !shouldHideForMe(doc)) {
                ensureInstanceVisible(doc);
            }
            deferredSweep();
            if (!shouldHideForMe(doc)) {
                setTimeout(() => {
                    try {
                        const root = getSidebarRoot();
                        if (!root)
                            return;
                        const li = root.querySelector(`li.chat-message[data-message-id="${doc.id}"]`);
                        if (li instanceof HTMLElement) {
                            if (blind && !li.classList.contains('blind'))
                                li.classList.add('blind');
                            if (private_ && !li.classList.contains('whisper'))
                                li.classList.add('whisper');
                            markVisibility(li, doc);
                        }
                    }
                    catch { /* ignore */ }
                }, POST_FRAME_ENFORCE_MS);
                if (secret) {
                    setTimeout(() => {
                        try {
                            const root = getSidebarRoot();
                            if (!root)
                                return;
                            const li = root.querySelector(`li.chat-message[data-message-id="${doc.id}"]`);
                            if (!li) {
                                dbgDebug("chat-visibility | secret msg not in DOM, forcing ChatLog re-render");
                                try {
                                    ui.chat?.render?.();
                                }
                                catch { /* ignore */ }
                                setTimeout(() => {
                                    try {
                                        const r2 = getSidebarRoot();
                                        if (!r2)
                                            return;
                                        const li2 = r2.querySelector(`li.chat-message[data-message-id="${doc.id}"]`);
                                        if (li2 instanceof HTMLElement) {
                                            markVisibility(li2, doc);
                                        }
                                        else {
                                            dbgDebug("chat-visibility | secret msg STILL not in DOM after retry");
                                        }
                                    }
                                    catch { /* ignore */ }
                                }, VISIBILITY_RETRY_DELAY_MS - VISIBILITY_RECHECK_DELAY_MS);
                            }
                            else if (li instanceof HTMLElement) {
                                markVisibility(li, doc);
                            }
                        }
                        catch { /* ignore */ }
                    }, VISIBILITY_RECHECK_DELAY_MS);
                }
            }
        }
    }
    catch { /* ignore */ }
});
Hooks.on("preUpdateChatMessage", (message, changed) => {
    try {
        if (!game.user?.isGM)
            return;
        if (!isPublicRevealUpdate(message, changed))
            return;
        clearBsrSecretFlags(changed);
    }
    catch (e) {
        dbgWarn("chat-visibility | preUpdateChatMessage public reveal", e);
    }
});
Hooks.on("updateChatMessage", (message, changed) => {
    try {
        refreshLinkedResultCards(message, changed);
        if (isBsrSecret(message) && !isRevealedToCurrentUser(message))
            return;
        deferredSweep();
    }
    catch { /* ignore */ }
});
// ---- Settings change: hideForeignSecrets ----
Hooks.on("updateSetting", (setting) => {
    try {
        if (setting?.key === `${MOD}.hideForeignSecrets`) {
            applyCssGuard();
            try {
                ui.chat?.render?.();
            }
            catch { /* ignore */ }
            sweepAllRoots();
        }
    }
    catch { /* ignore */ }
});
// ---- Early init: apply CSS guard and visibility patch before ChatLog renders ----
Hooks.once("setup", () => {
    try {
        if (!game?.user)
            return;
        ensureGlobalStyle();
        applyCssGuard();
        if (!game.user.isGM)
            patchMessageVisibility();
    }
    catch { /* ignore */ }
});
// ---- Init ----
Hooks.once("ready", () => {
    const isGM = !!game.user.isGM;
    if (isGM) {
        document.documentElement.setAttribute("data-bsr-gm", "1");
        const hiddenLabel = L("BSR.Chat.Label.HiddenFromPlayers", "Hidden from players");
        _hiddenLabelText = `🔒 ${hiddenLabel}`;
    }
    ensureGlobalStyle();
    applyCssGuard();
    if (!isGM)
        patchMessageVisibility();
    observeSidebar();
    installAudioPatches();
    registerAudioHooks();
    if (!isGM) {
        try {
            game.messages?.forEach?.((msg) => {
                if (isSecret(msg) && !shouldHideForMe(msg)) {
                    ensureInstanceVisible(msg);
                }
            });
        }
        catch { /* ignore */ }
        try {
            ui.chat?.render?.();
        }
        catch { /* ignore */ }
    }
    deferredSweep();
    dbgDebug(`chat-visibility | ready | gm=${isGM} | hide=${shouldHideForeignSecrets()}`);
});
Hooks.on("renderChatLog", () => { applyCssGuard(); observeSidebar(); deferredSweep(); });
