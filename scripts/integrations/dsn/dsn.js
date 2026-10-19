import { MOD } from "../../core/constants.js";
import { dsnRecord, getDsnAudience, getDsnDisplay, getDsnRecipients, readDsnAudience } from "../../core/policy/dsn-visibility.js";
import { dbgWarn } from "../../debug/logger.js";
import { openMute } from "../../feature/audio-suppression.js";
import { installDsnDirectAdapter } from "./direct-rolls.js";
Hooks.on("diceSoNiceMessagePreProcess", (messageId, interception) => {
    const audience = getDsnAudience(game.messages.get(messageId));
    if (audience && getDsnDisplay(audience) === "none")
        interception.willTrigger3DRoll = false;
});
Hooks.on("diceSoNiceRollStart", (messageId, context) => {
    try {
        const message = messageId ? game.messages.get(messageId) : null;
        const audience = message ? getDsnAudience(message) : readDsnAudience(context.roll, context.user);
        if (!audience)
            return;
        const display = getDsnDisplay(audience);
        // An already blocked local call may still send real dice to its recipients.
        if (!context.blind && display === "ghost") {
            context.roll.ghost = true;
            if (context.dsnRoll)
                context.dsnRoll.ghost = true;
        }
        if (display === "none")
            context.blind = true;
        if (display === "ghost" && game.user?.id !== audience.authorId)
            openMute(2500);
        // The public direct-call adapter handles synchronized per-client visibility.
        const allowed = getDsnRecipients(audience, context.roll.ghost === true);
        const supplied = context.users?.map(user => typeof user === "string" ? user : user.id);
        const recipients = supplied?.length ? allowed.filter(id => supplied.includes(id)) : allowed;
        context.users = recipients.length ? recipients : ["__bsr_no_recipients__"];
    }
    catch (error) {
        dbgWarn("dsn | roll visibility failed", error);
    }
});
Hooks.on("preCreateChatMessage", (message) => {
    if (!getDsnAudience(message))
        return;
    // DSN's interactive path ignores RollStart's blind/ghost decisions.
    message.updateSource({ "flags.dice-so-nice.interactive": false, "flags.dice-so-nice.interactiveThrow": null });
});
// Stamp each roll, rather than consuming a global "next animation" mode.
for (const name of ["Skill", "AbilityCheck", "SavingThrow", "DeathSave", "Tool", "Attack", "Damage"]) {
    Hooks.on(`dnd5e.post${name}RollConfiguration`, (rolls, config, _dialog, message) => {
        const source = dsnRecord(message);
        const subject = dsnRecord(dsnRecord(config).subject);
        const actor = subject.documentName === "Actor" ? subject : dsnRecord(subject.actor);
        const token = dsnRecord(actor.token);
        if (!Array.isArray(rolls))
            return;
        for (const roll of rolls) {
            const options = dsnRecord(dsnRecord(roll).options);
            const mode = source.rollMode ?? options.rollMode;
            const audience = token.hidden && actor.type !== "character" && mode === "blind" ? getDsnAudience({
                author: game.user, blind: mode === "blind", whisper: [],
                speaker: token.id && token.parent ? { scene: dsnRecord(token.parent).id, token: token.id } : undefined
            }) : null;
            if (audience)
                options[MOD] = { ...dsnRecord(options[MOD]), dsn: audience };
        }
    });
}
Hooks.on("diceSoNiceReady", installDsnDirectAdapter);
