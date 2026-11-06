## [Unreleased]

-


## [1.4.3] - 2026-11-06

### Changed
- Updated GitHub links, badges, author metadata, license attribution, release workflow, and publishing instructions for the renamed Flashiiio account.
- Updated the documented target environment to Foundry VTT 14.370

## [1.4.2] - 2026-10-19

### Changed
- Updated the module for Foundry VTT 14.369 and dnd5e 6.0.6.
- Update Dice So Nice integration for DSN 6.4.4: use message-preprocess and roll-start hooks for visibility, replace obsolete `show` / `_showAnimation` overlays with a narrow public `showForRoll` adapter using native `animateRoll` for synchronized secret rolls.
- Associate direct-roll privacy with the exact roll's serialized options instead of consuming a global next-animation mode. Coalesce concurrent direct calls only for the same roll object.

### Fixed
- Preserve native Foundry v14 combat-tracker buttons, effect icons/tooltips, and their event handlers when masking NPC names. Mask only the name label and portrait alternative text; keep GM, player-character, and revealed-NPC names visible.
- Mask unrevealed NPC targets in dnd5e 6 attack and saving-throw cards, including grouped target menus, accessible labels, and embedded save/check summaries. Player-authored cards follow the target's reveal state independently of the sender.
- Resolve chat tokens against their originating scene and refresh name visibility using the v14 `updateToken(token, changed, ...)` signature.

## [1.4.1] - 2026-05-23

This release expands Blind Skill Rolls with ability check support and improves chat privacy.

### Added
- Added **Ability Check** support for Blind GM Roll and Private GM Roll.

### Changed
- Expanded the **Skills & Saving Throws** settings menu to include **Ability Checks**.
- Improved death save roll-mode enforcement before the roll dialog and during message creation.
- Simplified chat privacy settings: hiding foreign secret messages now also mutes their dice sounds.
- Simplified general settings by removing legacy integration controls from the BSR settings UI.

### Fixed
- Fixed death save visibility not always being applied early enough for the roll configuration dialog.
- Fixed BSR private/blind roll flags not being cleared when a message is revealed publicly.
- Fixed a GM chat context option to reveal BSR private roll messages to everyone.

### Compatibility
- Updated verified Foundry VTT compatibility to **14.363**.
- Updated verified dnd5e compatibility to **5.3.3**.

## [1.4.0] - 2026-04-18

This release improves MidiQOL and Dice So Nice compatibility, migrates the codebase to TypeScript, adds custom chat card colors, and fixes several dice visibility and timing issues.

### Added
- **Custom Chat Card Colors** — players and GMs can now customize the background color (including transparency) of blind and private roll chat cards.
- **TypeScript migration** — the entire codebase has been converted to TypeScript for improved maintainability and type safety. No behavioral changes for users.

### Changed
- **Dice So Nice integration reworked** — the roll mode is now preserved reliably between the roll and the dice animation, even when other modules process the message in between. Ghost dice markers survive across network serialization so remote players see the correct animation.
- **Pending roll tracking improved** — pending skill and save rolls are now tracked per actor, preventing stale state from leaking between different characters or roll types. A safety limit prevents unbounded memory growth.
- **Roll config dialog guard improved** — the guard now clears state per actor instead of globally and handles chained rolls (e.g. ability checks triggered by skill rolls) without interfering with the primary roll.
- **Chat visibility enforcement strengthened** — visibility is now applied via inline styles to guarantee correct display regardless of other modules or themes overriding CSS.
- Updated FoundryVTT compatibility verified to **14.360**.
- Updated dnd5e compatibility to **5.3.1**.

### Fixed
- Fixed Dice So Nice showing public dice instead of ghost dice for blind/private rolls due to a timing issue where the roll mode was cleared before the dice animation ran.
- Fixed double dice animation appearing when MidiQOL is active, where a second unhandled animation would show public dice to the roller.
- Fixed ghost dice markers not reaching remote clients, causing other players to see incorrect dice animations.
- Fixed the roller seeing real dice instead of ghost dice on blind rolls when MidiQOL triggers an additional dice animation.
- Fixed death save ghost dice not appearing for other players when MidiQOL handles the roll.
- Fixed hidden NPC token rolls leaking ghost dice to players when Dice So Nice's "show ghost dice" option was enabled.
- Fixed private roll messages becoming invisible to players when MidiQOL overrides the whisper list after BSR has already set it.
- Fixed "Reveal to Roller" not showing dice content to the original roller after the GM reveals a blind message.
- Fixed a brief visibility flash where Foundry's own rendering could temporarily override BSR's display settings before the chat card settled.
- Fixed blind roll dice sounds leaking to players in edge cases where the muting was not enforced strongly enough.
- Fixed rare cases where chat messages could report incorrect visibility when the standard visibility override was blocked by another module.

## [1.3.0] - 2026-04-02

This release expands Blind Skill Rolls beyond skill checks with new saving throw support, private roll options, fast-forward controls, and broader Foundry/dnd5e compatibility updates.

## Added
- Added **Saving Throw** support, including per-save configuration for forced **Blind GM Roll** behavior.
- Added **Private GM Roll** support for both **skills** and **saving throws**.
- Added a unified **Skills & Saving Throws** configuration UI.
- Added a new **Fast Forward** configuration menu with separate **GM** and **player** settings.
- Added **Reveal to roller** support for blind roll chat messages.
- Added a dedicated option to hide **blind saving throw chat messages** from the roller.
- Added **permanent NPC reveal**.
- Added GM-facing visual indicators for permanently revealed NPCs in chat and the combat tracker.
- Added expanded localization entries for new roll types, privacy modes, fast-forward settings, and NPC reveal controls.

## Changed
- Updated compatibility from **Foundry VTT v13** to **Foundry VTT v14**.
- Updated verified compatibility to **Foundry VTT 14.359**.
- Added explicit **dnd5e 5.3.0** compatibility in the module manifest.
- Reworked the old skill-only configuration into a broader **skills + saves** workflow.
- Improved compatibility for blind rolls, saving throws, and fast-forward behavior in automated roll workflows.
- Updated styling and templates to support the expanded UI and Foundry v14 rendering flow.

## Fixed
- Fixed roll-mode enforcement so configured blind/private rolls are re-applied after the roll configuration dialog is rendered.
- Fixed several compatibility issues related to **Foundry v14**, **ApplicationV2**, and **dnd5e 5.3** roll handling.
- Fixed save/skill roll detection in mixed workflows, especially when fast-forward skips the configuration dialog.
- Fixed stale pending save state leaking into other roll types.
- Fixed chat visibility handling so messages revealed to the original roller are no longer hidden incorrectly.
- Improved private roll handling in supported display and automation workflows.
- Improved author/whisper detection in chat and death save handling.
- Improved NPC reveal refresh behavior when permanent reveal flags change.

## [1.2.2] - 2026-03-12
### Fixed
- **Troubleshooter**
  - Fixed a startup freeze on Foundry VTT v13 where the Troubleshooter could recurse during world loading in combination with libWrapper.

## [1.2.1] - 2026-03-01
### Added
- **Troubleshooter**
  - Added a new Troubleshooter menu that generates a JSON report (Foundry/system/module versions, BSR settings dump, installed modules list, optional MidiQOL snapshot)

### Changed
- Refined skill roll handling to improve reliability and compatibility on Foundry v13+.

## [1.2.0] - 2026-02-19
### Added
- **NPC Masking 2.0**
  - NPC masking now works per **individual token** instead of per actor.
  - GM-only settings to define a placeholder name for hidden NPCs.

- **Theme & UX options**
  - Added **light** and **dark** themes for the Blind Skill Rolls configuration dialogs.
  - New setting to select the preferred theme for the BSR GUIs.
  - New setting to **enable/disable sync notifications** between Blind Skill Rolls and MidiQOL.

- **Full i18n coverage for settings UIs**
  - All user-facing labels and messages for:
    - **Chat / privacy configuration**
    - **Blind Skill Rolls configuration**
    - **Death Saves configuration**
  are now driven by the language files.

- **MidiQOL sync integration**
  - Two-way sync between BSR’s blind skill list and MidiQOL’s “which skill checks are rolled blind” setting.
  - On initialisation, **Blind Skill Rolls acts as the primary source of truth**:
    - MidiQOL adopts BSR’s blind skill list when both are active.
    - Optional fallback: if BSR is empty but MidiQOL has a list, BSR can import it once.

### Changed
- **ApplicationV2 migration**
  - Migrated all BSR configuration dialogs from the legacy Application V1 API to the **Application V2 API**:
  - Improves forward compatibility with newer Foundry core versions.

- **Startup & console output**
  - Cleaned up most internal debug logging.
  - On successful startup, the module now prints a single, clear message

### Fixed
- **Invisible chat cards**
  - Hidden/placeholder chat messages used for internal handling no longer take up vertical space or push the chat log upwards.

- **NPC masking & GM visibility**
  - NPC masking no longer affects **GM** as message author.
  - Fixed cases where GM rolls appeared anonymised to players when no token/actor was selected.

- **Tidy5e Death Saves**
  - Death save rolls now work correctly with the **Tidy5e** character sheet:
    - The death save die on the portrait / Tidy5e overlay triggers properly.
    - Behaviour respects BSR’s death-save privacy settings (public / private GM / blind GM).

- **Deprecated API usage**
  - Replaced usage of `ChatMessageMidi#user` with the newer `ChatMessageMidi#author` API to avoid deprecation warnings and prepare for future Foundry versions.

- **Player permissions during sync**
  - Fixed a permissions error where **non-GM** users would see:
    - `User X lacks permission to update Setting [...]`
  when the blind skill list was updated.
  - Sync updates for MidiQOL/BSR settings are now only performed from the GM side.


## [1.1.0] - 2026-01-18
### Changed
- **Unified Dice So Nice behaviour for blind/private rolls**  
  Ensured that, regardless of how the roll is triggered (core dnd5e roll, MidiQOL roll, or a roll intercepted and re-created as a blind GM roll by the module), **Dice So Nice** shows the correct dice to the correct recipients:
  - **Private Death Saves** (`DeathSavesMode = privateroll`):
    - Roller: normal dice + chat message  
    - GM: normal dice + chat message  
    - Other players: nothing  
  - **Blind Death Saves** (`DeathSavesMode = blindroll`):
    - Roller: ghost/partial dice view  
    - GM: normal dice + chat message  
    - Other players: nothing  
  - **Forced Blind Skills**:
    - Roller: ghost/partial dice view + limited chat (depending on settings)  
    - GM: normal dice + chat message  
    - Other players: nothing  

- **Compatibility with and without MidiQOL**  
  The above behaviour was explicitly aligned to work:
  - with **MidiQOL** installed and active,  
  - without **MidiQOL**,  
  - and also when **MidiQOL’s “Fast Forward Ability Rolls”** option is enabled.

### Added
- **Blind Death Saves message settings**  
  - New setting to allow **blind death save chat messages to be hidden from the roller**, while the GM still sees the full message and other players see nothing.
  - Corresponding GUI controls in the Death Saves configuration dialog.

- **Blind Skill Rolls message settings**  
  - New setting to allow **blind skill roll chat messages to be hidden from the roller**, matching the death save behaviour.
  - Corresponding GUI controls in the Blind Skill Rolls configuration dialog.

## [1.0.1] - 2025-10-11
### Added
- **Death Saves privacy & roll-mode**: Enforce roll mode via setting (`blindroll` / `gmroll` / `publicroll` / `selfroll`) and hide death-save UI for players when blind is active (chat tray & Portrait Panel).
- **Chat privacy**: Hide blind/whisper messages that aren’t addressed to the user (sidebar and popouts); optional muting of foreign dice sounds.
- **GM privacy**: Option to sanitize public GM rolls for non-GMs (strip formulas/tooltips), with an exception for trusted users (“Trusted users see details”).
- **NPC name masking & reveal**: Players see NPCs as **“Unknown”** by default; GMs can reveal/hide per token/actor (stored as flags) with live updates across chat.
- **Settings UI**: Dedicated sections for Chat/Privacy and Death Saves; multi-language strings (EN/DE/FR/ES/IT/PL).

### Changed
- Hardened skill roll detection against multiple dnd5e flag shapes (`flags.dnd5e.roll.skillId | skill | context.skill`).
- Unified console output styling (dark-red module prefix).

### Known limitations
- The “Hide NPC names by default” toggle is currently a placeholder; NPCs are masked for players unless revealed by a GM.


## [1.0.0] - 2025-09-30
### Added
- Initial release (Foundry v13 + dnd5e): automatically force selected skills to **Blind GM Roll**, with per-skill toggles and an optional “blind all skills by default”.
