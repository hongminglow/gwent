# Oathbound Product Spec

## Status

Draft: `v0.1`

This document captures the current product understanding before implementation. It is intended to be reviewed, corrected, and expanded before core systems are built.

## Product Intent

Build a private, hobby-focused browser recreation of *The Witcher 3: Wild Hunt* Gwent play style. The target is not just "similar"; the rules, rhythm, faction identity, hand pressure, passing strategy, and row-based combat should follow Witcher 3 Gwent as closely as practical.

The player chooses one of the four base Gwent factions before entering a match. The opponent randomly chooses one of the remaining three factions. Each faction has different cards, stats, abilities, strengths, weaknesses, faction perks, leader cards, and visual effects.

## Fan Project And Credit Note

This project is intended as a private, non-commercial developer hobby project. Gwent, The Witcher, related characters, original card designs, original game rules, and associated IP belong to CD PROJEKT RED and their respective rights holders.

The implementation target for this repo is a faithful Witcher 3 Gwent-style recreation for learning and experimentation. If the project ever becomes public, commercial, or distributed widely, the asset, naming, and legal strategy must be reviewed again.

## Experience Goals

- Make every card feel physical, valuable, and satisfying to play.
- Keep the rules readable and strategic rather than overly random.
- Make faction choice meaningful before the match starts.
- Let the player win through hand management, timing, passing, and ability combinations.
- Use Three.js for a premium 3D board, realistic card movement, lighting, camera moments, and visual effects.
- Keep UI controls clear and fast enough for repeated play.

## Core Game Loop

1. Player opens the game.
2. Player chooses one of the four base Gwent factions.
3. Opponent randomly receives one of the remaining three base factions.
4. Match loads into a 3D battlefield.
5. Both players draw starting hands.
6. Optional mulligan phase allows limited card replacement.
7. Players alternate turns.
8. On each turn, a player may:
   - Play one card.
   - Use a leader ability if available.
   - Pass.
9. A round ends when both players pass or no legal actions remain.
10. Highest battlefield score wins the round.
11. Best of three rounds wins the match.
12. Used cards mostly remain unavailable in later rounds, so every card played has long-term cost.

## Match Structure

### Win Condition

The first player to win two rounds wins the match.

### Round Scoring

Each player has a total score calculated from all active rows:

```text
total score = close combat row + ranged combat row + siege combat row + active modifiers
```

The player with the higher score when the round ends wins that round.

### Passing

Passing is a core strategic action. Once a player passes, they no longer play cards that round. The other player may continue playing until they also pass or choose to overtake the score.

### Card Persistence

Cards played during a round move to the discard pile at round end unless a card effect states otherwise. Hands are not fully refilled between rounds, making resource management central to the game.

## Battlefield Layout

Each player has three battlefield rows matching Witcher 3 Gwent:

| Row | Purpose |
| --- | --- |
| Close Combat | Front-line units and melee threats |
| Ranged Combat | Archers, mages, and ranged threats |
| Siege Combat | Siege engines and long-range war machines |

Each card defines which row or rows it can be played on.

## Card Series / Factions

MVP targets the four base Witcher 3 Gwent factions. Skellige is treated as post-MVP because it was added through the Blood and Wine expansion and would increase scope.

### 1. Northern Realms

Balanced military faction focused on formation strength, siege pressure, spies, tight bond cards, and reliable board value.

Faction perk:

- Draw one extra card after winning a round.

Core identity:

- Strong engines and siege units.
- Tight Bond can create very high row scores.
- Several spy tools help preserve hand advantage.
- Vulnerable to weather and Scorch when stacked too heavily.

### 2. Nilfgaardian Empire

Control faction focused on spies, medics, high-value non-hero units, and winning tied rounds.

Faction perk:

- Wins rounds that end in a draw.

Core identity:

- Strong card advantage tools.
- Powerful spies and medics.
- Good late-round pressure.
- Can force the player to respect tie states.

### 3. Scoia'tael

Flexible faction focused on agile cards, ranged pressure, and tactical row placement.

Faction perk:

- Decides who takes the first turn of the match.

Core identity:

- Many Agile units that can be placed in Close Combat or Ranged Combat.
- Good control over opening tempo.
- Flexible placement makes weather and row commitment more tactical.
- Less raw brute force than the most explosive factions.

### 4. Monsters

Swarm faction focused on Muster chains, overwhelming Close Combat rows, and carryover pressure.

Faction perk:

- Keeps one random unit card on the battlefield after each round.

Core identity:

- Heavy use of Muster.
- Can flood the board with many linked cards from one play.
- Very high tempo and high-risk row stacking.
- Vulnerable to Biting Frost and Scorch.

### Post-MVP: Skellige

Skellige should be added after the base four factions are stable.

Known Skellige traits:

- Graveyard return in round three.
- Mardroeme and Berserker transformations.
- Weather reduction through leader effects.

## Card Types

| Type | Description |
| --- | --- |
| Unit Card | Standard battlefield card with power, row, faction, and optional ability |
| Hero Card | Powerful unique unit, immune to most negative effects |
| Special Card | One-time effect such as weather, scorch, decoy, revive, or row buff |
| Leader Card | Faction commander with a limited-use ability |
| Legendary Card | Rare cinematic card with a major unique effect |

## Core Card Properties

Every card should be represented as structured data.

```ts
type Card = {
  id: string;
  name: string;
  faction: FactionId;
  type: CardType;
  rows: RowId[];
  basePower: number;
  abilities: AbilityId[];
  rarity: CardRarity;
  tags: string[];
  artKey: string;
  vfxKey?: string;
  audioKey?: string;
};
```

## Core Abilities

These abilities should be considered the first major rules set.

| Ability | Effect |
| --- | --- |
| Spy | Played on enemy side, then draws cards for owner |
| Medic | Revives a valid non-hero, non-special unit from discard |
| Muster | Summons matching linked cards from deck |
| Morale Boost | Adds power to units in the same row or nearby position |
| Tight Bond | Same-name units multiply or increase each other's strength |
| Scorch | Destroys the strongest eligible unit or tied units |
| Decoy | Swaps with a non-hero battlefield card and returns that card to hand |
| Weather | Sets affected row unit strength to 1 unless immune |
| Clear Weather | Removes active weather effects |
| Commander's Horn | Doubles the strength of units in one row, limited to one per row |
| Agile | Allows placement in Close Combat or Ranged Combat, then locks placement |
| Hero | Immune to special cards, weather, and most abilities |
| Summon Avenger | Spawns a stronger replacement after removal, used in later expansion scope |
| Mardroeme | Triggers Berserker transformation, used in later Skellige scope |
| Berserker | Transforms when affected by Mardroeme, used in later Skellige scope |

## Starting Deck Rules

Target Witcher 3 Gwent-style deck rules:

- Each playable deck must include at least 22 unit cards.
- Each deck can include up to 10 special cards.
- Each deck has one selected leader card.
- Neutral cards can be included if deck-building is enabled.
- MVP may use fixed prebuilt decks, but those decks should still obey the minimum unit card and special card limits.
- Deck builder can be added after the battle system is stable.

## Starting Hand Rules

Initial recommendation:

- Each player draws 10 cards at match start.
- Player may redraw up to 2 cards once during the opening redraw phase.
- Opponent mulligan can be simulated automatically.
- Cards are not fully redrawn between rounds.

## AI Opponent

V1 should include local AI only.

AI requirements:

- Randomly select from the three factions not chosen by the player.
- Evaluate legal card plays.
- Understand current score difference.
- Decide when to pass.
- Avoid wasting high-value cards when already winning.
- Use simple faction-specific priorities.

AI difficulty can be added later:

- Easy: loose scoring logic, occasional mistakes.
- Normal: basic hand conservation and pass timing.
- Hard: combo awareness and better round sacrifice logic.

## Three.js Presentation Spec

Three.js should render the table, cards, board, lighting, camera, and visual effects.

### Board

- 3D tabletop battlefield.
- Distinct player and opponent sides.
- Three rows per player.
- Clear placement zones.
- Score indicators near each row.
- Subtle faction-themed environment details.

### Cards

- Physical card thickness.
- Rounded or beveled card mesh.
- High-resolution front texture.
- Back texture per faction or universal back.
- Hover lift and highlight.
- Flip animation.
- Draw from deck animation.
- Play-to-row animation.
- Discard animation.
- Inspection zoom.

### Camera

- Default angled tactical view.
- Smooth focus on selected card.
- Short cinematic push-in for major effects.
- Return to playable view after animation.

### Visual Effects

Examples:

- Scorch: fire line across affected row.
- Slain / slice elimination: when a card is destroyed, the camera briefly locks onto the card, a blade-trail slices through it, the card surface splits or tears with sparks and embers, then the destroyed card collapses into fragments before moving to discard.
- Weather: rain, frost, fog, or storm over target row.
- Medic: glow trail from discard to board.
- Spy: shadowy transfer effect to enemy side.
- Leader ability: faction emblem burst.
- Legendary card: unique entrance animation.

The slain / slice elimination sequence is a first-class feature, not a generic fade-out. Rule resolution should mark cards as destroyed, then the renderer should play the slain sequence before the simulation finalizes visible removal from the board.

## UI And HUD

Use DOM or React overlays for text-heavy UI. Do not force all menus into the WebGL canvas.

Required surfaces:

- Main menu.
- Faction selection.
- Deck preview.
- Loading screen.
- In-match HUD.
- Round result modal.
- Match result modal.
- Settings.
- Card inspection panel.
- Debug overlay.

In-match HUD should show:

- Player round wins.
- Opponent round wins.
- Current total scores.
- Row scores.
- Cards remaining in hand.
- Deck and discard counts.
- Current turn owner.
- Pass state.
- Leader ability availability.

## Input Model

Actions should be mapped explicitly instead of hard-coded directly inside scene objects.

| Action | Mouse / Touch | Keyboard |
| --- | --- | --- |
| Select card | Click / tap card | Arrow keys or tab focus |
| Inspect card | Right click / long press | `I` |
| Play card | Drag to row or click row | `Enter` |
| Cancel selection | Click empty board | `Esc` |
| Pass round | Pass button | `P` |
| Use leader | Leader button | `L` |
| Confirm modal | Button | `Enter` |
| Toggle debug | Debug button | Backtick |

## Architecture Boundaries

### Simulation Layer

The simulation owns:

- Match state.
- Round state.
- Turn order.
- Decks.
- Hands.
- Graveyards.
- Board rows.
- Score calculation.
- Ability resolution.
- AI decisions.
- Saveable state.

The simulation must not depend on Three.js objects.

### Renderer Layer

The renderer owns:

- Three.js scene.
- Camera.
- Lighting.
- Meshes.
- Materials.
- Particles.
- Animation playback.
- Raycasting and pointer plumbing.

The renderer should consume simulation state and emit player intents, not own the rules.

### UI Layer

The UI owns:

- Menus.
- HUD.
- Buttons.
- Modals.
- Card text readability.
- Settings.
- Accessibility-sensitive controls.

### Asset Layer

The asset system owns:

- Manifest keys.
- Texture loading.
- GLB loading.
- Audio loading.
- FX presets.
- Faction theme mapping.

## Suggested Project Modules

```text
src/
  game/
    simulation/
      matchState.ts
      matchReducer.ts
      scoring.ts
      abilities.ts
      ai.ts
      deckFactory.ts
    data/
      factions.ts
      cards.ts
      leaders.ts
    renderer/
      threeApp.ts
      boardScene.ts
      cardMesh.ts
      cameraRig.ts
      effects.ts
      animationQueue.ts
    ui/
      screens/
      hud/
      cardInspector/
    assets/
      manifest.ts
      loader.ts
    input/
      actions.ts
      inputMap.ts
```

## Asset Policy

- Use GLB or glTF 2.0 for 3D models.
- Use compressed web-friendly textures where possible.
- Use stable manifest keys instead of depending on raw filenames.
- Separate asset domains:
  - `cards`
  - `boards`
  - `factions`
  - `fx`
  - `audio`
  - `ui`
- Do not ship unoptimized raw 3D exports directly.

## Save Data Boundary

Save only serializable simulation data.

Do save:

- Selected faction.
- Match state.
- Round state.
- Deck order if needed.
- Hand card IDs.
- Board card IDs and modifiers.
- Discard card IDs.
- Leader ability state.
- Settings.

Do not save:

- Three.js meshes.
- Materials.
- Camera objects.
- Animation timelines.
- DOM nodes.

## Debug And Test Tools

V1 should include internal debug tools:

- Start match with selected factions.
- Force specific hand.
- Spawn specific card.
- Trigger any card ability.
- Skip to round result.
- Show score calculation breakdown.
- Show current simulation JSON.
- Toggle animation speed.
- Toggle AI autoplay.

## MVP Scope

The first playable build should include:

- Four factions / card series.
- Base factions are Northern Realms, Nilfgaardian Empire, Scoia'tael, and Monsters.
- Fixed starter deck per faction.
- Player faction selection.
- Opponent random faction selection from remaining factions.
- Best-of-three match.
- Three rows per player.
- Unit, hero, special, and leader cards.
- Core score calculation.
- Core abilities.
- Basic AI.
- 3D board.
- 3D card draw, hover, inspect, play, and discard animations.
- Dedicated slain / slice elimination VFX for destroyed cards.
- Round and match result UI.
- Debug tools for testing cards.

## Post-MVP Scope

Possible later additions:

- Deck builder.
- Card collection.
- Unlock progression.
- Campaign mode.
- Ranked AI ladder.
- Online multiplayer.
- More factions.
- Premium animated cards.
- Voice lines.
- Replay system.
- Mobile-first layout.
- Controller support.
- Card crafting or economy.

## Open Questions

1. Should Skellige be included in MVP or held for post-MVP?
2. Should the first implementation use React for UI overlays?
3. Should cards be fixed starter decks first, or should deck building be part of the first playable version?
4. Should the opponent AI have visible difficulty settings in V1?
5. Should the game target desktop first, mobile first, or both from the beginning?
6. Should premium animated card art be part of V1 or a later polish milestone?

## Reference Links

These references are used for rule verification:

- [Gwent rules and faction perks - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent)
- [Gwent rules and deck composition - GwentCards](https://www.gwentcards.com/index.html)
- [Gwent overview and base faction perks - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent)
- [Gwent special cards and abilities - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_special_cards)
- [Neutral cards, weather, Decoy, Scorch, Horn - Fextralife](https://thewitcher3.wiki.fextralife.com/Neutral%2BGwent%2BCards)

## Recommended First Build Plan

1. Build the simulation-only rules engine with no Three.js dependency.
2. Add card data for four small starter factions.
3. Add a text/debug match runner to verify rules quickly.
4. Add Three.js board, camera, card meshes, and basic card movement.
5. Connect UI actions to simulation intents.
6. Add core visual effects.
7. Add AI and pass logic.
8. Polish round flow, card inspection, and faction identity.
