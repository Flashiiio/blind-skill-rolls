import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveAbilityCheckVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { normalizeAbilityId } from "../core/policy/ability-check-policy.js";
import { setPendingAbilityCheck, peekPendingAbilityCheck, clearPendingAbilityCheck, clearPendingAbilityChecksForActor } from "../core/state/pending-ability-check.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
import { setDsnRollMode } from "../core/policy/dsn-visibility.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { setRollConfigSelectBlind, setRollConfigSelectPrivate } from "../ui/roll-config-dialog.js";
import { dbgWarn } from "../debug/logger.js";
import { getRollMetadata } from "../core/policy/roll-classification.js";
const CHECK_BLIND_NOTE_KEY = "BSR.AbilityChecks.Note.BlindGMRoll";
const CHECK_BLIND_NOTE_FB = "This ability check is configured for Blind GM Roll";
const CHECK_PRIVATE_NOTE_KEY = "BSR.AbilityChecks.Note.PrivateGMRoll";
const CHECK_PRIVATE_NOTE_FB = "This ability check is configured for Private GM Roll";
const resolveActorId = (cfg) => cfg?.subject?.id ?? cfg?.subject?.actor?.id ?? cfg?.actorId ?? null;
const abilityIdFrom = (...values) => {
    for (const value of values) {
        const abilityId = normalizeAbilityId(value);
        if (abilityId)
            return abilityId;
    }
    return null;
};
const isSecondaryAbilityHook = (config) => {
    const names = config?.hookNames;
    return Array.isArray(names) && (names.includes("skill") || names.includes("tool") || names.includes("savingThrow") || names.includes("save") || names.includes("deathSave"));
};
const applyVisibilityToConfig = (config, abilityId, vis) => {
    if (!vis.mode || !config || typeof config !== "object")
        return;
    config.rollMode = vis.mode;
    if (config.dialog && typeof config.dialog === "object")
        config.dialog.rollMode = vis.mode;
    setPendingAbilityCheck(abilityId, null, resolveActorId(config));
    if (vis.mode === BLIND) {
        guardedHookOnce("renderRollConfigurationDialog", (app, el) => setRollConfigSelectBlind(el ?? app?.element, CHECK_BLIND_NOTE_KEY, CHECK_BLIND_NOTE_FB));
    }
    else if (vis.mode === GMROLL) {
        guardedHookOnce("renderRollConfigurationDialog", (app, el) => setRollConfigSelectPrivate(el ?? app?.element, CHECK_PRIVATE_NOTE_KEY, CHECK_PRIVATE_NOTE_FB));
    }
};
Hooks.on("dnd5e.preRollAbilityCheckV2", (cfg, dialog, message) => {
    try {
        if (isSecondaryAbilityHook(cfg))
            return;
        const key = abilityIdFrom(cfg?.ability, cfg?.abilityId, cfg?.roll?.abilityId, cfg?.roll?.ability, cfg?.roll?.context?.ability, cfg?.context?.ability, cfg?.data?.abilityId, cfg?.data?.ability);
        if (!key)
            return;
        const vis = resolveAbilityCheckVisibility(key);
        if (!vis.mode) {
            clearPendingAbilityChecksForActor(null, resolveActorId(cfg));
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
        dbgWarn("preRollAbilityCheckV2", e);
    }
});
Hooks.on("dnd5e.postAbilityCheckRollConfiguration", (rolls, config, dialog, message) => {
    try {
        if (isSecondaryAbilityHook(config))
            return;
        const key = abilityIdFrom(config?.ability, config?.abilityId, config?.roll?.abilityId, config?.roll?.ability, config?.roll?.context?.ability, config?.context?.ability, config?.data?.abilityId, config?.data?.ability, rolls?.[0]?.data?.abilityId, rolls?.[0]?.data?.ability, rolls?.[0]?.options?.abilityId, rolls?.[0]?.options?.ability, peekPendingAbilityCheck(null, resolveActorId(config)));
        if (!key)
            return;
        const vis = resolveAbilityCheckVisibility(key);
        if (!vis.mode) {
            clearPendingAbilityChecksForActor(null, resolveActorId(config));
            return;
        }
        if (message && typeof message === "object")
            message.rollMode = vis.mode;
        if (Array.isArray(rolls))
            for (const roll of rolls) {
                if (roll?.options)
                    setDsnRollMode(roll, vis.mode);
            }
        setPendingAbilityCheck(key, null, resolveActorId(config));
    }
    catch (e) {
        dbgWarn("postAbilityCheckRollConfiguration", e);
    }
});
Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
    try {
        const metadata = getRollMetadata(data);
        const docMetadata = getRollMetadata(msg);
        if (metadata.skill || docMetadata.skill || metadata.tool || docMetadata.tool)
            return;
        const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
        const authorId = typeof author === "object" ? author.id : author;
        const actorId = msg?.speaker?.actor ?? data?.speaker?.actor ?? null;
        const pendingKey = peekPendingAbilityCheck(authorId, actorId);
        const effectiveRollType = metadata.type ?? docMetadata.type;
        const rollType = typeof effectiveRollType === "string" ? effectiveRollType.toLowerCase().replace(/[-_\s]/g, "") : null;
        if (rollType && !["ability", "abilitycheck", "check"].includes(rollType))
            return;
        if (!rollType && !pendingKey)
            return;
        let key = abilityIdFrom(metadata.ability, docMetadata.ability);
        if (!key) {
            try {
                for (const roll of (msg?.rolls ?? [])) {
                    const ab = abilityIdFrom(roll?.options?.abilityId, roll?.options?.ability, roll?.options?.context?.ability, roll?.data?.abilityId, roll?.data?.ability, roll?.data?.context?.ability);
                    if (ab) {
                        key = ab;
                        break;
                    }
                }
            }
            catch { /* ignore */ }
        }
        if (!key)
            key = pendingKey;
        if (!key)
            return;
        const vis = resolveAbilityCheckVisibility(key);
        if (!vis.mode)
            return;
        const recipients = buildMessageRecipients(vis.mode, authorId);
        msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
        msg.updateSource({ [`flags.${MOD}.rollKind`]: "abilityCheck" });
        if (recipients.bsrBlind) {
            msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
        }
        if (recipients.bsrPrivate) {
            msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
        }
        if (vis.mode === BLIND)
            setDsnPendingMode("blind");
        else if (vis.mode === GMROLL)
            setDsnPendingMode("private");
        clearPendingAbilityCheck(key, authorId, actorId);
    }
    catch (e) {
        dbgWarn("preCreateChatMessage (ability checks)", e);
    }
});
