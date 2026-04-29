# Oathbound Rule Reference

Status: Phase 2 audit complete.

This document converts Witcher 3 Gwent reference material into implementation rules for Oathbound. It is written for the simulation layer first; Three.js should only consume rule events and play animations.

## Sources

- [Gwent - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent)
- [Gwent - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent)
- [GwentCards rules summary](https://www.gwentcards.com/index.html)
- [Gwent special cards - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_special_cards)
- [Commander's Horn - Witcher Wiki](https://witcher.fandom.com/wiki/Commander%27s_Horn_%28gwent_card%29)
- [Decoy - Witcher Wiki](https://witcher.fandom.com/wiki/Decoy_%28gwent_card%29)
- [Scorch - Witcher Wiki](https://witcher.fandom.com/wiki/Scorch_%28gwent_card%29)
- [Hero cards - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_hero_cards)
- [Agile cards - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_agile_cards)
- [Medic cards - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent_medic_cards)
- [Muster cards - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent_muster_cards)
- [Tight Bond cards - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent_tight_bond_cards)
- [Morale Boost cards - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_morale_boost_cards)

## Implementation Summary

MVP target:

- Four base factions only: Northern Realms, Nilfgaardian Empire, Scoia'tael, and Monsters.
- Skellige is post-MVP.
- Use Witcher 3 Gwent-style rules where documented.
- If a source conflict exists, use the most conservative Witcher 3 mini-game behavior and mark it for original-game playtest.

## Deck Construction

Rules:

- A playable deck must contain at least 22 unit cards.
- Hero cards count as unit cards for the 22-card minimum.
- A deck may contain up to 10 special cards.
- No hard upper unit limit is required, but larger decks reduce draw consistency.
- Neutral cards may be included once deck building exists.
- MVP can use fixed starter decks, but each starter deck must obey the unit minimum and special-card cap.

Simulation requirements:

- Validate deck before match creation.
- Reject decks with fewer than 22 unit cards.
- Reject decks with more than 10 special cards.
- Keep leader card outside the draw deck.

## Match Start

Rules:

- Each player has one leader card.
- Starting player is selected at match start.
- Witcher Wiki describes this as a coin toss.
- Scoia'tael faction perk overrides this by allowing the Scoia'tael player to decide who takes the first turn.
- Each player draws 10 cards from their deck.
- Each player may redraw up to 2 cards once.
- No normal draw occurs later unless a card ability causes it.

Simulation requirements:

- Create match with deterministic RNG support.
- Select opponent faction from factions not chosen by the player.
- Shuffle both decks with the match RNG.
- Draw opening hands.
- Enter redraw phase.
- Apply Scoia'tael first-turn choice before normal turn flow.

## Turn Flow

Rules:

- Players alternate turns.
- A turn normally consists of one action:
  - Play a card.
  - Use a leader ability.
  - Pass.
- A player who passes cannot play more cards in that round.
- The opponent may continue taking turns until they pass or run out of cards.
- A player automatically passes if no legal action remains because they have no playable cards.

Simulation requirements:

- Track `activePlayerId`.
- Track `hasPassed` per player per round.
- Reject actions from a passed player.
- Advance to the next non-passed player where possible.
- End the round when both players have passed or both players cannot act.

## Round Resolution

Rules:

- Score is calculated from Close Combat, Ranged Combat, and Siege Combat rows.
- Highest total score wins the round.
- A normal draw causes both players to lose a round gem.
- Nilfgaardian Empire wins tied rounds through its faction perk.
- First player to win two rounds wins the match.
- At round end, battlefield cards are cleared unless protected by a faction perk or specific card effect.
- Scores reset to zero for the next round.

Simulation requirements:

- Resolve faction perks before writing round result.
- Emit explicit round result events.
- Move non-carryover unit cards to discard.
- Discard special cards after use.
- Preserve Monsters carryover card after row cleanup.

## Faction Perks

| Faction | MVP Rule |
| --- | --- |
| Northern Realms | Draw one extra card after winning a round. |
| Nilfgaardian Empire | Win tied rounds. |
| Scoia'tael | Decide who takes the first turn. |
| Monsters | Keep one random unit card on the battlefield after each round. |

Post-MVP:

| Faction | Rule |
| --- | --- |
| Skellige | At the start of round three, return two random normal unit cards from the graveyard to the battlefield. |

## Rows And Weather

Rows:

- Close Combat.
- Ranged Combat.
- Siege Combat.

Weather cards:

| Weather | Affected Row |
| --- | --- |
| Biting Frost | Close Combat |
| Impenetrable Fog | Ranged Combat |
| Torrential Rain | Siege Combat |
| Clear Weather | Removes active weather |

Rules:

- Weather applies to both players.
- Weather reduces affected non-hero units to strength 1.
- Hero cards ignore weather.
- Clear Weather removes active weather effects.
- Multiple weather effects may coexist if they affect different row types.

Simulation requirements:

- Track weather by row type.
- Apply weather before row buffs in score calculation unless a more exact original-game interaction is proven otherwise.
- Keep score calculation pure and inspectable.

## Core Abilities

### Agile

Rule:

- Agile units may be placed in either Close Combat or Ranged Combat.
- Once placed, they cannot be moved just because they are Agile.

Simulation requirements:

- Legal placement rows are `close` and `ranged`.
- Store chosen row on the card instance.

### Hero

Rule:

- Hero cards are immune to special cards, weather cards, and abilities.
- Hero cards also do not benefit from strength-boosting effects such as Commander's Horn.

Simulation requirements:

- Exclude heroes from weather.
- Exclude heroes from Commander's Horn.
- Exclude heroes from Scorch targeting.
- Exclude heroes from Decoy.
- Exclude heroes from Medic revive choices unless an original-game edge case proves otherwise.

### Medic

Rule:

- Medic chooses one unit from the discard pile and plays it instantly.
- Heroes and special cards are not valid Medic targets.
- A revived unit's play ability can trigger again.

Simulation requirements:

- Present valid discard targets.
- Play revived card through the normal ability pipeline.
- Block hero and special targets.

### Morale Boost

Rule:

- Adds +1 strength to all other units in the same row.
- The Morale Boost card does not buff itself.
- Source notes indicate Morale Boost is applied after other strength multiplication such as Tight Bond.

Simulation requirements:

- Apply after Tight Bond.
- Exclude the source card from its own boost.
- Respect hero immunity.

### Muster

Rule:

- When a Muster card is played, matching same-name cards are found in the deck and played instantly.
- Available sources consistently describe deck lookup. Cards already in hand are not treated as confirmed MVP pull targets.

Simulation requirements:

- Find matching card definitions or group IDs in the remaining deck.
- Remove pulled cards from deck.
- Play pulled cards to the same valid row group.
- Do not retrigger infinite Muster loops from cards pulled by the same Muster resolution.

Playtest note:

- Verify in the original game whether same-name cards already in hand are ever pulled. MVP implementation should use deck-only until proven otherwise.

### Spy

Rule:

- Spy cards are played on the opponent's battlefield.
- Spy strength counts toward the opponent's score.
- The Spy owner draws two cards from their deck.

Simulation requirements:

- Store `ownerId` and `controllerId` separately.
- Place the spy on the opponent side.
- Add spy strength to opponent scoring.
- Draw up to two cards for the owner.

### Tight Bond

Rule:

- Same-name Tight Bond units in the same row multiply each matching card's base strength by the number of matching cards.
- Example: two matching 4-strength cards become 8 each; three become 12 each.

Simulation requirements:

- Group by same card name or bond group.
- Apply before Morale Boost.
- Respect weather and hero immunity interactions through score-order tests.

Playtest note:

- Confirm exact ordering when Tight Bond, weather, and Commander's Horn all affect the same row.

## Special Cards

### Commander's Horn

Rule:

- Doubles the strength of all eligible unit cards in one row.
- Limited to one Commander's Horn effect per row.
- Hero cards are not affected.

Simulation requirements:

- Track row horn state.
- Reject second horn on a row if the row already has a horn effect.
- Treat unit cards with built-in horn effects as row horn providers.

### Decoy

Rule:

- Swaps with a card on the player's battlefield and returns that card to hand.
- Does not affect hero cards.
- Often used to replay Spy or Medic units.

Simulation requirements:

- Only allow target cards controlled by the active player.
- Reject hero targets.
- Return target to owner's hand.
- Place Decoy in the target's prior board position, then discard it at round cleanup unless original behavior requires earlier discard.

Playtest note:

- Verify whether Decoy remains visually on the row until round end or is immediately treated as a special/discard placeholder in all cases.

### Scorch

Generic Scorch rule:

- Discards after playing.
- Kills the strongest eligible card or tied strongest eligible cards on the battlefield.
- Can kill the active player's own card if it is tied for strongest.
- Hero cards are immune.

Row-specific Scorch variants:

- Some unit/leader effects target only a specific enemy row.
- Known row-specific versions may require a combined row-strength threshold of 10 or more.

Simulation requirements:

- Represent generic and row-specific Scorch as separate effect variants.
- Emit one destruction event per destroyed card for the renderer.
- Destruction events must feed the slain / slice VFX before visible board removal.

## Renderer Event Requirements

Rule resolution should emit explicit renderer events:

| Rule Event | Renderer Use |
| --- | --- |
| `card.played` | Card moves from hand/deck to row |
| `card.drawn` | Card draw animation |
| `card.revived` | Medic revive trail |
| `card.destroyed` | Slain / slice elimination VFX |
| `weather.applied` | Row weather particles |
| `weather.cleared` | Weather removal pulse |
| `row.buff.applied` | Commander's Horn or Morale Boost pulse |
| `round.ended` | Round result cinematic |

The simulation must never wait on Three.js objects directly. Instead, the game coordinator can delay the next visible step until the renderer reports animation completion.

## Rule Items Requiring Original-Game Playtest

These are not blockers for Phase 3, but they should be verified before final gameplay tuning:

- Exact score-ordering when weather, Tight Bond, Morale Boost, and Commander's Horn stack.
- Whether Muster ever pulls same-name cards from hand in Witcher 3, or only from deck.
- Exact visual/discard timing for Decoy after it swaps with a unit.
- Whether all generic Scorch cases ignore total battlefield strength thresholds, while row-specific Scorch variants enforce row thresholds.
- Exact Monsters carryover timing when the carried unit was affected by weather or row buffs in the prior round.

