import { MOD } from "../constants.js";
import { shouldHideForeignSecrets } from "./chat-privacy.js";
export function dsnRecord(value) {
    return value !== null && typeof value === "object" ? value : {};
}
function userId(value) {
    return typeof value === "string" ? value : String(dsnRecord(value).id ?? "");
}
function gmIds() {
    return ChatMessage.getWhisperRecipients("GM").map(user => user.id);
}
function hiddenNpc(speaker) {
    const source = dsnRecord(speaker);
    if (!source.scene || !source.token)
        return false;
    try {
        const token = fromUuidSync(`Scene.${source.scene}.Token.${source.token}`);
        return token?.hidden === true && !!token.actor && token.actor.type !== "character";
    }
    catch {
        return false;
    }
}
export function getDsnAudience(message) {
    const source = dsnRecord(message);
    const flags = dsnRecord(dsnRecord(source.flags)[MOD]);
    const recipients = Array.isArray(source.whisper) ? source.whisper.map(userId).filter(Boolean) : [];
    const authorId = userId(source.author) || game.user?.id || "";
    const revealedToRoller = flags.revealedToRoller === true;
    if (source.blind || flags.bsrBlind) {
        return { mode: hiddenNpc(source.speaker) ? "hidden" : "blind", authorId, recipients: recipients.length ? recipients : gmIds(), revealedToRoller };
    }
    if (flags.bsrPrivate)
        return { mode: "private", authorId, recipients: gmIds(), revealedToRoller };
    if (recipients.length)
        return { mode: "whisper", authorId, recipients, revealedToRoller };
    return null;
}
export function getDsnDisplay(audience) {
    const viewer = game.user;
    if (!viewer)
        return "none";
    const author = viewer.id === audience.authorId;
    if (audience.mode === "hidden")
        return viewer.isGM && audience.recipients.includes(viewer.id) ? "real" : "none";
    if (audience.mode === "blind") {
        if (viewer.isGM && audience.recipients.includes(viewer.id))
            return "real";
        return author ? (audience.revealedToRoller ? "real" : "ghost") : "none";
    }
    if (audience.recipients.includes(viewer.id) || author || (audience.mode === "private" && viewer.isGM))
        return "real";
    return audience.mode === "private" && !shouldHideForeignSecrets() ? "ghost" : "none";
}
export function getDsnRecipients(audience, ghost) {
    const recipients = audience.mode === "hidden" || audience.mode === "blind"
        ? audience.recipients.filter(id => game.users.get(id)?.isGM) : audience.recipients;
    const includeAuthor = audience.mode !== "hidden"
        && (audience.mode !== "blind" || ghost || audience.revealedToRoller);
    return Array.from(new Set([...recipients, ...(includeAuthor ? [audience.authorId] : [])].filter(Boolean)));
}
export function readDsnAudience(roll, author) {
    const options = dsnRecord(dsnRecord(roll).options);
    const saved = dsnRecord(dsnRecord(options[MOD]).dsn);
    if (["blind", "private", "whisper", "hidden"].includes(String(saved.mode)) && typeof saved.authorId === "string"
        && Array.isArray(saved.recipients) && saved.recipients.every(id => typeof id === "string")) {
        return { mode: saved.mode, authorId: saved.authorId,
            recipients: saved.recipients, revealedToRoller: saved.revealedToRoller === true };
    }
    const mode = options.rollMode;
    if (mode !== "blind" && mode !== "gm" && mode !== "self")
        return null;
    const authorId = userId(author) || game.user?.id || "";
    return {
        mode: mode === "blind" ? "blind" : "whisper",
        authorId, recipients: mode === "self" ? [authorId] : gmIds(), revealedToRoller: false
    };
}
export function setDsnRollMode(roll, mode) {
    const options = dsnRecord(dsnRecord(roll).options);
    options.rollMode = mode;
    const audience = getDsnAudience({ author: game.user, blind: mode === "blind",
        flags: { [MOD]: { bsrPrivate: mode === "gm" } } });
    if (audience)
        options[MOD] = { ...dsnRecord(options[MOD]), dsn: audience };
}
