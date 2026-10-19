import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveSaveVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { setPendingSave, peekPendingSave, clearPendingSave, clearPendingSavesForActor } from "../core/state/pending-save.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
import { setDsnRollMode } from "../core/policy/dsn-visibility.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { setRollConfigSelectBlind, setRollConfigSelectPrivate } from "../ui/roll-config-dialog.js";
import { dbgWarn } from "../debug/logger.js";
import { getRollMetadata } from "../core/policy/roll-classification.js";

const SAVE_BLIND_NOTE_KEY = "BSR.Saves.Note.BlindGMRoll";
const SAVE_BLIND_NOTE_FB = "This saving throw is configured for Blind GM Roll";
const SAVE_PRIVATE_NOTE_KEY = "BSR.Saves.Note.PrivateGMRoll";
const SAVE_PRIVATE_NOTE_FB = "This saving throw is configured for Private GM Roll";

const resolveActorId = (cfg: any): string | null => cfg?.subject?.id ?? cfg?.subject?.actor?.id ?? cfg?.actorId ?? null;

const applyVisibilityToConfig = (config: any, abilityId: string, vis: { mode: string | null }): void => {
  if (!vis.mode || !config || typeof config !== "object") return;

  config.rollMode = vis.mode;
  if (config.dialog && typeof config.dialog === "object") config.dialog.rollMode = vis.mode;

  setPendingSave(abilityId, null, resolveActorId(config));
  if (vis.mode === BLIND) {
    guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectBlind(el ?? app?.element, SAVE_BLIND_NOTE_KEY, SAVE_BLIND_NOTE_FB));
  } else if (vis.mode === GMROLL) {
    guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectPrivate(el ?? app?.element, SAVE_PRIVATE_NOTE_KEY, SAVE_PRIVATE_NOTE_FB));
  }
};

const handleSavePreRoll = (hookLabel: string, cfg: any, dialog: any, message: any): void => {
  try {
    if (cfg?.hookNames?.includes("deathSave")) return;
    const key: string | null = cfg?.ability ?? cfg?.abilityId ?? null;
    if (!key) return;
    const vis = resolveSaveVisibility(key);
    if (!vis.mode) {
      clearPendingSavesForActor(null, resolveActorId(cfg));
      return;
    }

    applyVisibilityToConfig(cfg, key, vis);
    if (message && typeof message === "object") message.rollMode = vis.mode;
    if (dialog && typeof dialog === "object") {
      if (!dialog.options) dialog.options = {};
      if (!dialog.options.default) dialog.options.default = {};
      dialog.options.default.rollMode = vis.mode;
    }
  } catch (e) {
    dbgWarn(hookLabel, e);
  }
};

Hooks.on("dnd5e.preRollSavingThrowV2", (cfg: any, dialog: any, message: any) => {
  handleSavePreRoll("preRollSavingThrowV2", cfg, dialog, message);
});

Hooks.on("dnd5e.postSavingThrowRollConfiguration", (rolls: any, config: any, dialog: any, message: any) => {
  try {
    if (config?.hookNames?.includes("deathSave")) return;
    const key: string | null = config?.ability ?? config?.abilityId
      ?? rolls?.[0]?.data?.ability ?? rolls?.[0]?.options?.ability
      ?? rolls?.[0]?.options?.abilityId
      ?? peekPendingSave(null, resolveActorId(config));
    if (!key) return;

    const vis = resolveSaveVisibility(key);
    if (!vis.mode) {
      clearPendingSavesForActor(null, resolveActorId(config));
      return;
    }

    if (message && typeof message === "object") message.rollMode = vis.mode;
    if (Array.isArray(rolls)) for (const roll of rolls) { if (roll?.options) setDsnRollMode(roll, vis.mode); }
    setPendingSave(key, null, resolveActorId(config));
  } catch (e) {
    dbgWarn("postSavingThrowRollConfiguration", e);
  }
});

Hooks.on("preCreateChatMessage", (msg: any, data: any, options: any, userId: any) => {
  try {
    const metadata = getRollMetadata(data);
    const docMetadata = getRollMetadata(msg);
    if (metadata.skill || docMetadata.skill || metadata.tool || docMetadata.tool) return;

    const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
    const authorId: string = typeof author === "object" ? author.id : author;
    const actorId: string | null = msg?.speaker?.actor ?? data?.speaker?.actor ?? null;

    const effectiveRollType = metadata.type ?? docMetadata.type;
    if (effectiveRollType && effectiveRollType !== "save") return;
    if (!effectiveRollType && !peekPendingSave(authorId, actorId)) return;

    let key: string | null = metadata.ability ?? docMetadata.ability;

    if (!key) {
      try {
        for (const roll of (msg?.rolls ?? [])) {
          const ab = roll?.options?.abilityId ?? roll?.options?.ability ?? roll?.data?.abilityId ?? roll?.data?.ability ?? null;
          if (ab) { key = ab; break; }
        }
      } catch { /* ignore */ }
    }

    if (!key) key = peekPendingSave(authorId, actorId);
    if (!key) return;

    const vis = resolveSaveVisibility(key);
    if (!vis.mode) return;

    const recipients = buildMessageRecipients(vis.mode, authorId);
    msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
    msg.updateSource({ [`flags.${MOD}.rollKind`]: "save" });
    if (recipients.bsrBlind) {
      msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
    }
    if (recipients.bsrPrivate) {
      msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
    }
    if (vis.mode === BLIND) setDsnPendingMode('blind');
    else if (vis.mode === GMROLL) setDsnPendingMode('private');
    clearPendingSave(key, authorId, actorId);
  } catch (e) {
    dbgWarn("preCreateChatMessage (saves)", e);
  }
});
