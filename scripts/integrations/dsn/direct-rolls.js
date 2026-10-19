import { MOD } from "../../core/constants.js";
import { dsnRecord, getDsnAudience, readDsnAudience } from "../../core/policy/dsn-visibility.js";
import { shouldHideForeignSecrets } from "../../core/policy/chat-privacy.js";
import { dbgWarn } from "../../debug/logger.js";
const installed = new WeakSet();
const inFlight = new WeakMap();
export function installDsnDirectAdapter(api) {
    if (!api || installed.has(api) || typeof api.animateRoll !== "function" || typeof api.showForRoll !== "function")
        return;
    installed.add(api);
    const original = api.showForRoll;
    api.showForRoll = function (roll, user, synchronize, users, blind, messageId, speaker, options) {
        const message = messageId ? game.messages.get(messageId) : null;
        const audience = message ? getDsnAudience(message) : readDsnAudience(roll, user);
        const safeOptions = audience && options?.skipRollStartHook ? { ...options, skipRollStartHook: false } : options;
        if (!synchronize || !audience)
            return original.call(this, roll, user, synchronize, users, blind, messageId, speaker, safeOptions);
        const running = inFlight.get(roll);
        if (running)
            return running;
        // Explicit split real/ghost calls already carry separate recipient restrictions.
        if (blind || dsnRecord(roll).ghost || options?.ghost || options?.secret) {
            return original.call(this, roll, user, synchronize, users, blind, messageId, speaker, safeOptions);
        }
        try {
            // animateRoll serializes audience data and computes visibility on every client.
            const constructor = roll.constructor;
            if (typeof constructor.fromData !== "function")
                throw new Error("Evaluated roll cannot be copied");
            const local = constructor.fromData(JSON.parse(JSON.stringify(roll)));
            local.options = { ...local.options, [MOD]: { ...dsnRecord(local.options?.[MOD]), dsn: audience } };
            const supplied = users?.map(user => typeof user === "string" ? user : user.id);
            const allowed = audience.recipients.filter(id => !supplied?.length || supplied.includes(id));
            const privateGhosts = audience.mode === "private" && !shouldHideForeignSecrets() && !supplied?.length;
            const whisper = privateGhosts ? [] : allowed.length ? allowed : ["__bsr_no_recipients__"];
            if (supplied?.length) {
                const restricted = { ...audience, recipients: allowed, mode: audience.mode === "private" ? "whisper" : audience.mode };
                local.options[MOD] = { ...dsnRecord(local.options[MOD]), dsn: restricted };
            }
            const result = this.animateRoll(local, {
                author: audience.authorId, speaker: message?.speaker ?? speaker,
                whisper: audience.revealedToRoller ? Array.from(new Set([...whisper, audience.authorId])) : whisper,
                blind: (audience.mode === "blind" && !audience.revealedToRoller) || audience.mode === "hidden"
            });
            inFlight.set(roll, result);
            void result.finally(() => { if (inFlight.get(roll) === result)
                inFlight.delete(roll); }).catch(() => { });
            return result;
        }
        catch (error) {
            dbgWarn("dsn | direct secret animation failed", error);
            return Promise.resolve(false);
        }
    };
}
