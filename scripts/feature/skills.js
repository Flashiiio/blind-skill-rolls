import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveSkillVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { setPendingSkill, peekPendingSkill, clearPendingSkill, clearPendingSkillsForActor } from "../core/state/pending-skill.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
import { setDsnRollMode } from "../core/policy/dsn-visibility.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { setRollConfigSelectBlind, setRollConfigSelectPrivate } from "../ui/roll-config-dialog.js";
import { dbgWarn } from "../debug/logger.js";
import { getRollMetadata } from "../core/policy/roll-classification.js";
const SKILL_BLIND_NOTE_KEY = "BSR.Skills.Note.BlindGMRoll";
const SKILL_BLIND_NOTE_FB = "This skill is configured for Blind GM Roll";
const SKILL_PRIVATE_NOTE_KEY = "BSR.Skills.Note.PrivateGMRoll";
const SKILL_PRIVATE_NOTE_FB = "This skill is configured for Private GM Roll";
const getMsgFromLi = (li) => {
    let el = null;
    if (li instanceof HTMLElement)
        el = li;
    else if (li?.dataset)
        el = li;
    if (!el)
        return null;
    const msgId = el.dataset?.messageId ?? el.dataset?.entryId ?? el.dataset?.documentId ??
        el.closest?.("[data-message-id]")?.dataset?.messageId ??
        el.closest?.("[data-entry-id]")?.dataset?.entryId ??
        null;
    return msgId ? game.messages?.get?.(msgId) : null;
};
const revealToRoller = async (message) => {
    if (!message)
        return;
    await message.setFlag(MOD, "revealedToRoller", true);
};
const revealToEveryone = async (message) => {
    if (!message)
        return;
    await message.update({
        blind: false,
        whisper: [],
        [`flags.${MOD}.bsrBlind`]: false,
        [`flags.${MOD}.bsrPrivate`]: false,
        [`flags.${MOD}.revealedToRoller`]: false
    });
};
const canRevealToRoller = (message) => {
    if (!message)
        return false;
    if (!message.blind && !message.getFlag?.(MOD, "bsrBlind"))
        return false;
    try {
        if (message.getFlag?.(MOD, "revealedToRoller"))
            return false;
    }
    catch { /* ignore */ }
    const authorId = message.author?.id ?? null;
    if (!authorId)
        return false;
    const authorUser = game.users?.get?.(authorId);
    if (!authorUser || authorUser.isGM)
        return false;
    return true;
};
const canRevealBsrPrivateToEveryone = (message) => {
    if (!message || !game.user?.isGM)
        return false;
    try {
        if (!message.getFlag?.(MOD, "bsrPrivate"))
            return false;
    }
    catch {
        return false;
    }
    return !!message.blind || (Array.isArray(message.whisper) && message.whisper.length > 0) || !!message.getFlag?.(MOD, "bsrPrivate");
};
const isBsrPrivateMessage = (message) => {
    try {
        return !!message?.getFlag?.(MOD, "bsrPrivate");
    }
    catch {
        return false;
    }
};
function suppressCoreMakePrivateForBsrPrivate(menuItems) {
    const coreConceal = menuItems.find((entry) => entry?.label === "CHAT.ConcealMessage" ||
        entry?.name === "CHAT.ConcealMessage" ||
        entry?.name === "Make Private");
    if (!coreConceal || coreConceal._bsrConcealWrapped)
        return;
    const originalVisible = coreConceal.visible;
    const originalCondition = coreConceal.condition;
    coreConceal.visible = (target) => {
        if (isBsrPrivateMessage(getMsgFromLi(target)))
            return false;
        if (typeof originalVisible === "function")
            return originalVisible(target);
        if (typeof originalCondition === "function")
            return originalCondition(target);
        return originalVisible ?? true;
    };
    coreConceal._bsrConcealWrapped = true;
}
// ---- Context-Menu: reveal actions ----
Hooks.on("getChatMessageContextOptions", (app, menuItems) => {
    suppressCoreMakePrivateForBsrPrivate(menuItems);
    const revealToRollerEntry = {
        name: game.i18n?.has?.("BSR.Skills.Action.RevealToRoller")
            ? game.i18n.localize("BSR.Skills.Action.RevealToRoller")
            : "Reveal to roller",
        icon: '<i class="fa-solid fa-eye"></i>',
        condition: (target) => {
            if (!game.user?.isGM)
                return false;
            return canRevealToRoller(getMsgFromLi(target));
        },
        callback: async (target) => revealToRoller(getMsgFromLi(target))
    };
    const revealToEveryoneEntry = {
        name: game.i18n?.has?.("BSR.Chat.Action.RevealToEveryone")
            ? game.i18n.localize("BSR.Chat.Action.RevealToEveryone")
            : "Reveal To Everyone",
        icon: '<i class="fa-solid fa-eye"></i>',
        condition: (target) => canRevealBsrPrivateToEveryone(getMsgFromLi(target)),
        callback: async (target) => revealToEveryone(getMsgFromLi(target))
    };
    const revealEveryoneIdx = menuItems.findIndex((i) => i.icon?.includes("fa-eye"));
    const insertAt = revealEveryoneIdx >= 0 ? revealEveryoneIdx + 1 : menuItems.length;
    menuItems.splice(insertAt, 0, revealToEveryoneEntry, revealToRollerEntry);
});
const resolveActorId = (cfg) => cfg?.subject?.id ?? cfg?.subject?.actor?.id ?? cfg?.actorId ?? null;
const applyVisibilityToConfig = (config, skillId, vis) => {
    if (!vis.mode || !config || typeof config !== "object")
        return;
    config.rollMode = vis.mode;
    if (config.dialog && typeof config.dialog === "object")
        config.dialog.rollMode = vis.mode;
    setPendingSkill(skillId, null, resolveActorId(config));
    if (vis.mode === BLIND) {
        guardedHookOnce("renderRollConfigurationDialog", (app, el) => setRollConfigSelectBlind(el ?? app?.element, SKILL_BLIND_NOTE_KEY, SKILL_BLIND_NOTE_FB));
    }
    else if (vis.mode === GMROLL) {
        guardedHookOnce("renderRollConfigurationDialog", (app, el) => setRollConfigSelectPrivate(el ?? app?.element, SKILL_PRIVATE_NOTE_KEY, SKILL_PRIVATE_NOTE_FB));
    }
};
// ---- dnd5e.preRollSkillV2 ----
Hooks.on("dnd5e.preRollSkillV2", (cfg, dialog, message) => {
    try {
        const key = cfg?.skill ?? cfg?.skillId ?? cfg?.abilitySkill ?? null;
        if (!key)
            return;
        const vis = resolveSkillVisibility(key);
        if (!vis.mode) {
            clearPendingSkillsForActor(null, resolveActorId(cfg));
            return;
        }
        applyVisibilityToConfig(cfg, key, vis);
        if (message && typeof message === "object")
            message.rollMode = vis.mode;
        if (dialog && typeof dialog === "object") {
            if (!dialog.options)
                dialog.options = {};
            if (!dialog.options.default)
                dialog.options.default = {};
            dialog.options.default.rollMode = vis.mode;
        }
    }
    catch (e) {
        dbgWarn("preRollSkillV2", e);
    }
});
// ---- dnd5e.postSkillRollConfiguration ----
Hooks.on("dnd5e.postSkillRollConfiguration", (rolls, config, dialog, message) => {
    try {
        const key = config?.skill ?? config?.skillId
            ?? rolls?.[0]?.data?.skill ?? rolls?.[0]?.options?.skill
            ?? rolls?.[0]?.options?.skillId
            ?? peekPendingSkill(null, resolveActorId(config));
        if (!key)
            return;
        const vis = resolveSkillVisibility(key);
        if (!vis.mode) {
            clearPendingSkillsForActor(null, resolveActorId(config));
            return;
        }
        if (message && typeof message === "object")
            message.rollMode = vis.mode;
        if (Array.isArray(rolls))
            for (const roll of rolls) {
                if (roll?.options)
                    setDsnRollMode(roll, vis.mode);
            }
        setPendingSkill(key, null, resolveActorId(config));
    }
    catch (e) {
        dbgWarn("postSkillRollConfiguration", e);
    }
});
// ---- preCreateChatMessage (Skills) ----
Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
    try {
        const metadata = getRollMetadata(data);
        const docMetadata = getRollMetadata(msg);
        const type = metadata.type ?? docMetadata.type;
        if (type && type !== "skill")
            return;
        let key = metadata.skill ?? docMetadata.skill;
        if (!key) {
            try {
                for (const roll of (msg?.rolls ?? [])) {
                    const sk = roll?.options?.skillId ?? roll?.options?.skill ?? roll?.data?.skillId ?? roll?.data?.skill ?? null;
                    if (sk) {
                        key = sk;
                        break;
                    }
                }
            }
            catch { /* ignore */ }
        }
        const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
        const authorId = typeof author === "object" ? author.id : author;
        const actorId = msg?.speaker?.actor ?? data?.speaker?.actor ?? null;
        if (!key)
            key = peekPendingSkill(authorId, actorId);
        if (!key)
            return;
        const vis = resolveSkillVisibility(key);
        if (!vis.mode)
            return;
        const recipients = buildMessageRecipients(vis.mode, authorId);
        msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
        msg.updateSource({ [`flags.${MOD}.rollKind`]: "skill" });
        if (recipients.bsrBlind) {
            msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
        }
        if (recipients.bsrPrivate) {
            msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
        }
        if (vis.mode === BLIND)
            setDsnPendingMode('blind');
        else if (vis.mode === GMROLL)
            setDsnPendingMode('private');
        clearPendingSkill(key, authorId, actorId);
    }
    catch (e) {
        dbgWarn("preCreateChatMessage (skills)", e);
    }
});
// ---- renderChatMessageHTML: Revealed-Badge ----
Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
        if (!game.user?.isGM)
            return;
        if (!message.getFlag?.(MOD, "revealedToRoller"))
            return;
        const meta = html.querySelector?.(".message-metadata");
        if (!meta || meta.querySelector?.(".bsr-revealed-badge"))
            return;
        const LABEL = game.i18n?.has?.("BSR.Skills.Label.RevealedToRoller")
            ? game.i18n.localize("BSR.Skills.Label.RevealedToRoller")
            : "Revealed to roller";
        const badge = document.createElement("span");
        badge.className = "bsr-revealed-badge";
        badge.setAttribute("title", LABEL);
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-eye fa-fw";
        badge.appendChild(icon);
        meta.insertBefore(badge, meta.firstChild);
    }
    catch (e) {
        dbgWarn("renderChatMessageHTML (revealed badge)", e);
    }
});
