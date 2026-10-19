// ── 0. Banner ──
Hooks.once("init", () => {
  const mod = game.modules.get("blind-skill-rolls");
  const title = (mod?.title ?? "Blind Skill Rolls").toUpperCase();
  const version = mod?.version ?? "unknown";

  console.log(`%c${title}`, [
    "color:#e53935", "font-size:40px", "font-weight:900",
    "letter-spacing:2px", "text-shadow:6px 6px 0 rgba(0,0,0,0.55)"
  ].join(";"));

  console.log(`%cv${version} | Loaded`, [
    "color:#e53935", "font-size:14px", "font-weight:700",
    "text-shadow:2px 2px 0 rgba(0,0,0,0.55)"
  ].join(";"));
});

// ── 1. Debug ──
import "./debug/logger.js";
import "./debug/troubleshooter.js";

// ── 2. Settings ──
import "./core/settings/base-settings.js";
import "./core/settings/general-settings.js";
import "./core/settings/skill-save-settings.js";
import "./core/settings/chat-settings.js";
import "./core/settings/death-settings.js";
import "./core/settings/dsn-settings.js";
import "./core/settings/ff-settings.js";

// ── 3. Integrations ──
import "./integrations/midi-qol/skill-save-sync.js";

// ── 3b. Roll-Config Guard ──
import "./core/state/roll-config-guard.js";

// ── 3c. Chat Card Colors ──
import "./ui/chat-card-colors.js";

// ── 4. Features ──
import "./feature/chat-visibility.js";
import "./feature/npc-hidden-token-rolls.js";
import "./feature/skills.js";
import "./feature/ability-checks.js";
import "./feature/saves.js";
import "./feature/death-saves.js";
import "./feature/fast-forward.js";
import "./feature/gm-privacy.js";
import "./feature/npc-reveal/index.js";

// ── 5. DSN Integration ──
import "./integrations/dsn/dsn.js";

// ── 6. MidiQOL Fixes ──
import "./integrations/midi-qol/npc-hidden-fix.js";
import "./integrations/midi-qol/death-save-fix.js";
import "./integrations/midi-qol/whisper-fixup.js";
