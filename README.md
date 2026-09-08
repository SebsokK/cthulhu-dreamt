# Cthulhu Dreamt — Unofficial Foundry VTT System

![Cthulhu Dreamt Unofficial](assets/CDunofficial.png)

---

> ⚠️ **This is an UNOFFICIAL, AI-assisted implementation.**
> This system is not affiliated with, endorsed by, or produced by the creators of Cthulhu Dreamt.
> It was built entirely with the assistance of an AI (Claude, by Anthropic).
> **If you have ethical concerns about AI-generated content, please do not use this module.**

---

## What is this?

This is a fully custom **Foundry VTT v14** game system for the **Cthulhu Dreamt** tabletop RPG. It was built from scratch to provide an immersive, bespoke experience that matches the game's dark sci-fi horror aesthetic — no Foundry native styling bleeding through.

The system was developed iteratively by a player for their own gaming group, using the official Cthulhu Dreamt manuscript as the authoritative rules reference.

---

## Features

### Character Sheet (PC)
- **Attributes** with pip system (Strong, Agile, Cunning, Vigilant, Careful, Tenacious)
- **Stress tracks** — Physical and Mental, with limit pips
- **Wound tracks** — Mild / Serious / Severe for Physical and Mental, clickable cells
- **Skills** with use counters (limited/unlimited), clicable to consume uses
- **Combat Proficiency** block with pip system (Close Quarters, Small Arms, Long Arms, Thrown, Unarmed, EDGe)
- **Inventory** — Weapons, Armor, Tools, Gear in separate panels
- **Goals** — Current and Completed goal tracking
- **Notes** — Rich text via ProseMirror

### NPC / TRACE Sheet
- Portrait, Name, Initiative, Target Number (TN)
- Physical and Mental Limit pips (damage received, color shifts to danger near limit)
- **Traits** block — named entries with bold name + description
- **Major Actions** — with damage formula, Physical/Mental type toggle, clickable dice roll
- **Minor Actions** — named entries with description
- All fields fully editable in-sheet

### Specialty System
- Drag & drop Specialty onto character sheet
- **Character Creation Wizard** — choose specialty (with attribute preview), choose starting Tier 1 skill
- Specialty Tier progression with Total Max AP prerequisites (Tier 2: 20 AP, Tier 3: 22 AP)
- Available Skills dialog (📖 button) — filters by Specialty and Tier, shows IP costs

### Progression
- **IP (Improvement Points)** tracking — Gained / Spent / IP Left
- **Available Skills dialog** — Specialty skills (10 IP), Universal skills (12 IP), Tier Upgrade (12 IP + 1 free skill)
- **Attribute Progression dialog** — cost = 2 × new max, cap at 12 individual / 40 total
- **Specialty Progression dialog** — Tier upgrade with prerequisites display

### Dice Rolling
- **Attribute rolls** — 1d12 + AP spent, with TEACH difficulty labels (Trivial → Harrowing)
- **Weapon attack rolls** — 1d12 + Proficiency + Modifier + AP, custom attribute selector
- **Spend AP** from chat roll cards — add AP after the roll
- **NPC damage rolls** — from Major Actions, Physical or Mental stress, posted to chat
- Roll cards with degree of success (Critical Failure → Critical Success)

### Weapons & Ammunition
- Shot tracking (value/max) per weapon
- **Reload button** in inventory — blocked if no compatible ammunition in inventory
- `ammoType` field on each weapon — matches item name in inventory
- Thrown weapons cannot be reloaded
- Shots remaining displayed in attack roll cards
- EDGe weapons using SWUBs handled as ammunition

### Rest & Recovery
- **REST button** in character header
- Three quality tiers: **Poor** (6 AP to distribute), **Good** (half Total Max AP to distribute), **Great** (full AP)
- Manual AP distribution dialog with real-time counter and attribute highlighting
- Stress recovery choice per quality tier
- Wound tracks reduced by 1 on Good/Great rest
- Skill uses refreshed on rest
- Rest summary posted to chat

### Compendiums
| Compendium | Contents |
|---|---|
| **Specialties** | 14 specialties with attributes, limits, carry capacity, skills |
| **Skills** | 139 skills — 13 Universal + 126 Specialty, with naming convention |
| **Weapons** | 34 weapons — Close Quarters, Small Arms, Long Arms, Thrown, EDGe |
| **Armor** | 8 armor pieces — civilian and military |
| **Equipment** | 41 items — tools, gear, backpacks, medical supplies, ammunition |
| **NPCs & TRACEs** | 27 stat blocks — all named NPCs and TRACEs from the campaign |

### Visual Design
- Dark Blue `#151b3d` / Deep `#0a0f24` backgrounds
- Ice Green `#56ed82` accents
- Space Grotesk / Hanken Grotesk for headings, JetBrains Mono for data
- Animated scan line effect on window headers
- IP Left pulsing glow animation
- Overload indicators (red blinking) for capacity and ammunition
- Zero Foundry native styling visible — fully custom skin

---

## Installation

1. Download the latest release ZIP
2. Extract to your Foundry VTT `Data/systems/` directory as `cthulhu-dreamt/`
3. Restart Foundry VTT
4. Create a new World using the **Cthulhu Dreamt** system

---

## Requirements

- **Foundry VTT v14** or higher
- **Dice So Nice** (optional, recommended) — for 3D dice on roll cards

---

## Skill Naming Convention

- `Unseen` → Universal skill
- `Unseen — Hunter` → Hunter version (different mechanics)
- `Pushing the Limit I — Athlete` → Evolutionary skill Tier 1
- `Custom Modifications III — Engineer` → Evolutionary skill Tier 3

---

## Disclaimer

This system was built using the **Cthulhu Dreamt** manuscript as a reference. All game content, rules, and lore belong to their respective creators. This implementation is a fan-made tool for personal use and is not for commercial distribution.

This project was developed with significant assistance from **Claude** (Anthropic), an AI language model. If you have concerns about AI-generated or AI-assisted software, please do not use this system.
