# Blind Skill Rolls (Foundry VTT · dnd5e)

[![stable](https://img.shields.io/github/v/release/GWagner2021/blind-skill-rolls.svg?label=stable&display_name=tag&sort=date&cacheSeconds=3600&_=20260302)](https://github.com/GWagner2021/blind-skill-rolls/releases/latest) ![downloads](https://img.shields.io/github/downloads/GWagner2021/blind-skill-rolls/blind-skill-rolls.zip?label=downloads&displayAssetName=false) ![license](https://img.shields.io/github/license/GWagner2021/blind-skill-rolls?label=license) [![discord](https://img.shields.io/badge/discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/upVqdYqg4p)

Blind Skill Rolls gives you much finer control over what players are allowed to learn from rolls, chat messages, and NPC presentation in dnd5e.

The module is built for tables that want secret information to stay secret. Instead of relying on manual roll-mode changes every time, you can define how the game should handle selected skills, saving throws, death saves, hidden NPCs, and masked identities. The result is a cleaner hidden-information workflow, less accidental metagaming, and more tension at the table.

The main features are described below, followed by additional helpers for hidden NPCs, name masking, chat privacy, and integrations.

## 🎲 Per-skill and per-save blind and private rolls

At its core, Blind Skill Rolls lets you decide that specific skill checks and saving throws should no longer behave like ordinary public rolls. You can configure each skill and each ability save individually and decide whether it should default to **Blind GM Roll** or **Private GM Roll**. That makes it much easier to keep checks like Insight, Investigation, Perception, or Stealth as well as important defensive saves under tighter control without changing the roll mode by hand every time. Blind and Private are handled as separate modes, so you can decide exactly how much the roller should still be allowed to see.

[Blind & Private Rolls – Visibility Matrix](https://github.com/GWagner2021/blind-skill-rolls/wiki/Blind-&-Private-Rolls-%E2%80%93-Visibility-Matrix)

## 💀 Death save privacy

Death saves get dedicated handling and can be kept public, limited to the GM and the roller, or fully blind. That allows them to stay uncertain and dramatic when that is the tone you want for your table. In blind mode, death save result indicators are also hidden from players on supported UI elements, so the outcome is not exposed somewhere else immediately.

## 👻 Hidden NPC support

Sometimes the secret is not just the roll result, but the acting creature itself. When an NPC token is hidden, its rolls can automatically default to **Blind GM Roll**. This applies to skill checks, saving throws, ability checks, tool checks, attack rolls, damage rolls, and related item or activity cards, so hidden enemies, unseen observers, or ambushers do not accidentally reveal themselves through a leftover roll mode.

## 🎭 NPC masking and reveal control

NPC names can be hidden from players and replaced with a placeholder until you decide otherwise. This is useful for unidentified creatures, disguised characters, suspicious strangers, or any situation where the real name should not be visible yet.

Name masking goes beyond a simple text swap. Reveal controls let the GM decide when a name becomes visible: temporary reveal can be handled per token, while permanent reveal can be toggled for the NPC more broadly. Reveal state stays consistent across the relevant interfaces, including chat and combat-related views.

## 💬 Chat privacy tools

Beyond changing roll modes, several chat privacy helpers reduce accidental leaks. Foreign blind or secret messages can be hidden from players who are not meant to see them. Dice sounds from other users’ secret rolls can be suppressed, so players do not constantly get audio feedback for things they should not notice. Public GM rolls can additionally be sanitized by stripping detailed roll formulas and tooltips for players, with an optional exception for trusted users.

## 👁️ Reveal to roller

When a blind skill roll should remain hidden at first but later be shown to the player who made it, a dedicated **Reveal to roller** option is available in the chat message context menu. This way the original blind behavior is preserved during the roll, and the result can be selectively shown to the original player afterward without revealing it to everyone else.

## ⚡ Fast Forward support

Dedicated **Fast Forward** controls let you choose which roll types should skip the roll configuration dialog, separately for GMs and players. This can be configured for attack rolls, damage rolls, ability checks, saving throws, skill checks, and tool checks, keeping the roll flow fast while still preserving the privacy rules defined here.

## 🎨 Chat card colors

To make different roll modes easier to tell apart at a glance, custom background colors can be applied to **blind** and **private** chat cards. Both colors are configurable to match your table’s preferences or the visual language of your other modules. Especially helpful when scanning chat for hidden information and wanting to immediately recognize which messages are blind, which are private, and which are normal public output.

## 🌍 Localization

Included languages are English, German, French, Spanish, Italian, Polish, and Russian.

## 📋 Requirements

- Foundry VTT **v14.369**
- **dnd5e 6.0.6**

## 🧩 Compatible modules

- **Dice So Nice**
- **Combat Tracker Dock**

## 📦 Installation

Manifest URL:

`https://github.com/GWagner2021/blind-skill-rolls/releases/latest/download/module.json`

## 💁 Support

Issues and feedback:

`https://github.com/GWagner2021/blind-skill-rolls/issues`

Discord:

`https://discord.gg/upVqdYqg4p`

