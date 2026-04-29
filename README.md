# Oathbound

Private developer hobby project to recreate the play style of Gwent from *The Witcher 3: Wild Hunt* as a cinematic browser game using Three.js.

The goal is a faithful 1v1 Gwent-style experience: four base factions, three battlefield rows per player, limited cards across best-of-three rounds, leader abilities, weather, spies, medics, Muster chains, Scorch, Commander's Horn, Decoy, and heavy hand-management pressure.

## Project Status

Current phase: Phase 17 audio complete. Next phase: Phase 18 polish.

The repository now contains the TypeScript/Vite/Three.js scaffold, product spec, rule reference, serializable simulation core, match flow, scoring system, ability engine, curated MVP faction cards, starter decks, validation tests, deterministic AI opponent, 3D board foundation, live renderer/simulation bridge, pointer-driven card interaction, slain / slice destruction VFX, ability-specific event VFX, main menu, faction selection, deck preview, opening redraw UI, in-match HUD, result modals, settings, debug overlay, a full debug tools drawer, expanded simulation/integration coverage, browser smoke screenshots, a procedural Web Audio cue system, volume/mute controls, and a recorded performance finding for the later optimization pass.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

Validate card and starter-deck data:

```bash
npm run validate:data
```

Run linting:

```bash
npm run lint
```

## Credits

Gwent, *The Witcher*, *The Witcher 3: Wild Hunt*, original factions, characters, card names, card designs, rules, and related IP belong to CD PROJEKT RED and their respective rights holders.

This repository is intended as a private, non-commercial fan/developer hobby project for learning, prototyping, and experimentation.

## Core Game

The player chooses one of the four base Gwent factions before a match starts. The opponent randomly chooses one of the remaining three factions.

MVP factions:

| Faction | Play Style | Faction Perk |
| --- | --- | --- |
| Northern Realms | Balanced military, siege strength, Tight Bond, spies | Draw one extra card after winning a round |
| Nilfgaardian Empire | Control, spies, medics, high-value units | Win rounds that end in a draw |
| Scoia'tael | Agile cards and flexible row placement | Decide who takes the first turn |
| Monsters | Muster swarm and carryover pressure | Keep one random unit on the battlefield after each round |

Post-MVP faction:

| Faction | Reason |
| --- | --- |
| Skellige | Expansion faction with graveyard return, Mardroeme, Berserker, and extra transformation rules |

## Match Rules

- A match is best two out of three rounds.
- Each player starts with 10 cards.
- Each player may redraw up to 2 cards once during the opening redraw phase.
- Players alternate turns.
- A turn usually plays one card, uses one leader ability, or passes.
- Once a player passes, they cannot play more cards that round.
- A round ends when both players pass or no legal actions remain.
- The highest score wins the round.
- Cards are not fully redrawn between rounds, so spending too many cards early can lose the match later.

## Battlefield

Each player has three rows:

- Close Combat
- Ranged Combat
- Siege Combat

Cards contribute strength to their row unless modified by weather, buffs, hero immunity, or other card abilities.

## Core Card Abilities

MVP should support:

- Agile
- Hero
- Medic
- Morale Boost
- Muster
- Spy
- Tight Bond
- Weather
- Clear Weather
- Commander's Horn
- Decoy
- Scorch

Post-MVP should support:

- Summon Avenger
- Mardroeme
- Berserker
- Skellige graveyard return

## Three.js Direction

Three.js owns the physical battle presentation:

- 3D tabletop board.
- Physical card meshes with thickness, shadows, lighting, hover states, flip animations, and placement movement.
- Cinematic camera focus for major effects.
- Faction-themed VFX.
- Weather effects over affected rows.
- Scorch fire sweep.
- Medic revive glow.
- Spy shadow transfer.
- Leader emblem burst.
- Legendary card entrance.

## Slain / Slice Card Elimination

Destroyed cards should not simply disappear.

When a card is defeated or destroyed, the renderer should play a dedicated slain sequence:

1. Camera focuses on the destroyed card.
2. A blade-trail or slash VFX cuts through the card.
3. The card surface splits, tears, burns, or fractures.
4. Sparks, embers, or magical particles burst from the cut.
5. The card collapses into fragments or dissolves.
6. The card then moves to the discard pile.

The simulation should mark the card as destroyed first, then the renderer should complete the slain animation before visible board removal.

## Architecture

The game should keep hard boundaries between systems:

| Layer | Owns |
| --- | --- |
| Simulation | Match state, turn order, cards, rows, scoring, abilities, AI, saveable state |
| Renderer | Three.js scene, camera, meshes, materials, animation playback, particles, raycasting |
| UI | Menus, HUD, buttons, modals, card inspection, settings, debug tools |
| Assets | Manifest keys, textures, GLB assets, audio, VFX presets, faction theme mapping |

Simulation state must not depend on Three.js objects. The renderer consumes state changes and emits player intents.

## Tech Stack

- TypeScript
- Vite
- Three.js
- DOM UI overlay
- JSON or TypeScript card database
- Reducer/state-machine style simulation

## Documentation

- [Game Spec](./GAME_SPEC.md)
- [Development Checklist](./DEVELOPMENT_CHECKLIST.md)
- [Rule Reference](./RULE_REFERENCE.md)

## Reference Links

These references are used for rule verification:

- [Gwent rules and faction perks - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent)
- [Gwent rules and deck composition - GwentCards](https://www.gwentcards.com/index.html)
- [Gwent overview and base faction perks - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent)
- [Gwent special cards and abilities - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_special_cards)
- [Neutral cards, weather, Decoy, Scorch, Horn - Fextralife](https://thewitcher3.wiki.fextralife.com/Neutral%2BGwent%2BCards)
- [Northern Realms deck - Witcher Wiki](https://witcher.fandom.com/wiki/Northern_Realms_Gwent_deck)
- [Nilfgaardian Empire deck - Witcher Wiki](https://witcher.fandom.com/wiki/Nilfgaardian_Empire_Gwent_deck)
- [Scoia'tael deck - Witcher Wiki](https://witcher.fandom.com/wiki/Scoia%27tael_Gwent_deck)
- [Monsters deck - Witcher Wiki](https://witcher.fandom.com/wiki/Monsters_Gwent_deck)
