# Development Checklist

This checklist tracks Oathbound phase by phase. Use it as the main progress board for batching work.

Legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked or needs decision

## Phase 0: Planning And Documentation

- [x] Create initial product spec.
- [x] Update spec target to faithful Witcher 3 Gwent-style play.
- [x] Add private fan project and credit note.
- [x] Add slain / slice card elimination requirement.
- [x] Create README.
- [x] Create development checklist.
- [x] Confirm whether MVP includes only the four base factions or includes Skellige at launch.
- [x] Confirm whether UI overlay should use React or plain DOM.
- [x] Confirm whether deck builder is post-MVP or MVP.
- [x] Confirm first playable platform priority: desktop only, responsive desktop/tablet, or desktop plus mobile.

## Phase 1: Project Foundation

- [x] Initialize TypeScript project.
- [x] Add Vite.
- [x] Add Three.js.
- [x] Decide React vs non-React UI shell.
- [x] Add linting and formatting.
- [x] Add basic test runner.
- [x] Create `src/` module structure.
- [x] Add asset folder structure.
- [x] Add debug build mode.
- [x] Add README run commands after tooling exists.

Phase 1 decisions:

- MVP factions: Northern Realms, Nilfgaardian Empire, Scoia'tael, and Monsters.
- Skellige: post-MVP.
- UI shell: plain DOM overlay for now.
- Deck builder: post-MVP.
- First playable target: desktop-first with responsive scaling.

Expected structure:

```text
src/
  game/
    simulation/
    data/
    renderer/
    ui/
    assets/
    input/
```

## Phase 2: Rule Reference Audit

- [x] Build a local rule notes file from Witcher 3 Gwent references.
- [x] Verify base deck requirements.
- [x] Verify match start flow.
- [x] Verify mulligan/redraw behavior.
- [x] Verify pass behavior.
- [x] Verify round win and tie behavior.
- [x] Verify faction perks.
- [x] Verify hero immunity.
- [x] Verify weather interaction.
- [x] Verify Commander's Horn interaction.
- [x] Verify Decoy limitations.
- [x] Verify Scorch targeting and tie handling.
- [x] Verify Medic limitations.
- [x] Verify Muster pulling order and valid zones.
- [x] Verify Tight Bond scoring.
- [x] Verify Morale Boost scoring.
- [x] Verify Agile placement locking.
- [x] Mark any rule that needs gameplay testing in the original game.

Phase 2 output:

- See [Rule Reference](./RULE_REFERENCE.md).

Rule references:

- [Gwent - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent)
- [Gwent - The Official Witcher Wiki](https://witcher-games.fandom.com/wiki/Gwent)
- [GwentCards rules summary](https://www.gwentcards.com/index.html)
- [Gwent special cards - Witcher Wiki](https://witcher.fandom.com/wiki/Gwent_special_cards)
- [Neutral Gwent Cards - Fextralife](https://thewitcher3.wiki.fextralife.com/Neutral%2BGwent%2BCards)

## Phase 3: Simulation Core

- [x] Define core enums and IDs:
  - [x] `PlayerId`
  - [x] `FactionId`
  - [x] `CardId`
  - [x] `RowId`
  - [x] `AbilityId`
  - [x] `CardType`
- [x] Define serializable `CardDefinition`.
- [x] Define serializable `CardInstance`.
- [x] Define `DeckState`.
- [x] Define `HandState`.
- [x] Define `BoardState`.
- [x] Define `DiscardState`.
- [x] Define `RoundState`.
- [x] Define `MatchState`.
- [x] Define `GameAction`.
- [x] Build reducer or state machine for match updates.
- [x] Add deterministic random seed support.
- [x] Add event log for renderer animations.
- [x] Add serialization and restore tests.

Phase 3 output:

- Serializable match-state model in `src/game/simulation/types.ts`.
- Deterministic RNG in `src/game/simulation/random.ts`.
- Reducer shell in `src/game/simulation/reducer.ts`.
- Empty match factory in `src/game/simulation/matchState.ts`.
- Event log helpers in `src/game/simulation/events.ts`.
- JSON serialization helpers in `src/game/simulation/serialization.ts`.

## Phase 4: Match Flow

- [x] Create match from selected player faction.
- [x] Randomly select opponent faction from remaining factions.
- [x] Shuffle decks.
- [x] Draw 10 opening cards per player.
- [x] Implement opening redraw of up to 2 cards.
- [x] Decide starting player.
- [x] Start round one.
- [x] Alternate turns.
- [x] Validate legal actions.
- [x] Implement pass.
- [x] End round when both players pass or cannot act.
- [x] Score round.
- [x] Apply faction win/loss/tie rules.
- [x] Move non-persistent board cards to discard.
- [x] Start next round.
- [x] End match after one player wins two rounds.
- [x] Emit match result.

Phase 4 output:

- Generated starter-deck factory in `src/game/simulation/deckFactory.ts`.
- Match creation and turn flow in `src/game/simulation/matchFlow.ts`.
- Basic score snapshot in `src/game/simulation/scoring.ts`.
- Match-flow reducer integration in `src/game/simulation/reducer.ts`.
- Match-flow tests in `src/game/simulation/matchFlow.test.ts`.

## Phase 5: Scoring System

- [ ] Calculate base unit strength.
- [ ] Apply weather row strength.
- [ ] Apply Clear Weather.
- [ ] Apply Commander's Horn.
- [ ] Apply Tight Bond.
- [ ] Apply Morale Boost.
- [ ] Apply hero immunity.
- [ ] Apply row totals.
- [ ] Apply player total.
- [ ] Add score breakdown debug output.
- [ ] Add tests for each scoring modifier.
- [ ] Add tests for stacked modifiers.
- [ ] Add tests for hero immunity against buffs and debuffs.

## Phase 6: Card Ability Engine

- [ ] Implement ability resolver pipeline.
- [ ] Implement target selection.
- [ ] Implement immediate effects.
- [ ] Implement delayed effects.
- [ ] Implement ability event logging for renderer.
- [ ] Implement `Spy`.
- [ ] Implement `Medic`.
- [ ] Implement `Muster`.
- [ ] Implement `Morale Boost`.
- [ ] Implement `Tight Bond`.
- [ ] Implement `Scorch`.
- [ ] Implement `Decoy`.
- [ ] Implement `Weather`.
- [ ] Implement `Clear Weather`.
- [ ] Implement `Commander's Horn`.
- [ ] Implement `Agile`.
- [ ] Implement `Hero`.
- [ ] Add complete ability tests.

Post-MVP abilities:

- [ ] Implement `Summon Avenger`.
- [ ] Implement `Mardroeme`.
- [ ] Implement `Berserker`.
- [ ] Implement Skellige round-three graveyard return.

## Phase 7: Faction Data

- [ ] Create Northern Realms faction definition.
- [ ] Create Nilfgaardian Empire faction definition.
- [ ] Create Scoia'tael faction definition.
- [ ] Create Monsters faction definition.
- [ ] Add faction perks.
- [ ] Add leader card definitions.
- [ ] Add starter deck for each faction.
- [ ] Verify each starter deck has at least 22 unit cards.
- [ ] Verify each starter deck has no more than 10 special cards.
- [ ] Add neutral cards needed for MVP.
- [ ] Add card art manifest keys.
- [ ] Add VFX manifest keys.
- [ ] Add card data validation script.

## Phase 8: AI Opponent

- [ ] Build legal action generator.
- [ ] Build score projection helper.
- [ ] Build simple card value evaluator.
- [ ] Add pass decision logic.
- [ ] Add round sacrifice logic.
- [ ] Add leader ability usage logic.
- [ ] Add Spy usage logic.
- [ ] Add Medic usage logic.
- [ ] Add Scorch usage logic.
- [ ] Add Weather usage logic.
- [ ] Add faction-specific priorities.
- [ ] Add AI difficulty config.
- [ ] Add AI autoplay debug mode.
- [ ] Add simulation tests for AI actions.

## Phase 9: Three.js Foundation

- [ ] Create renderer bootstrap.
- [ ] Create scene.
- [ ] Create perspective camera.
- [ ] Create camera rig.
- [ ] Create WebGL renderer.
- [ ] Create resize handling.
- [ ] Create lighting setup.
- [ ] Create 3D board/table.
- [ ] Create row placement zones.
- [ ] Create score plate anchors.
- [ ] Create deck and discard pile anchors.
- [ ] Create card mesh factory.
- [ ] Create card material factory.
- [ ] Create texture loader.
- [ ] Add render loop.
- [ ] Add debug camera mode.

## Phase 10: Renderer And Simulation Bridge

- [ ] Subscribe renderer to simulation state snapshots.
- [ ] Convert simulation card state into card meshes.
- [ ] Convert simulation row state into board placement.
- [ ] Play event-log animations in order.
- [ ] Block player input while blocking animations play.
- [ ] Emit player intents from renderer/UI.
- [ ] Keep renderer objects out of simulation state.
- [ ] Add animation queue.
- [ ] Add skipped/fast animation mode for testing.

## Phase 11: Card Interaction

- [ ] Raycast cards.
- [ ] Hover lift animation.
- [ ] Hover highlight.
- [ ] Select card.
- [ ] Inspect card.
- [ ] Drag card to valid row.
- [ ] Click card then click row placement.
- [ ] Show valid placement zones.
- [ ] Reject invalid placement with clear feedback.
- [ ] Play card-to-row animation.
- [ ] Animate draw from deck.
- [ ] Animate discard movement.
- [ ] Animate leader ability use.

## Phase 12: Slain / Slice VFX

- [ ] Define destruction event type from simulation.
- [ ] Add renderer animation contract for destroyed card IDs.
- [ ] Create blade slash trail effect.
- [ ] Add card cut line shader or decal.
- [ ] Add impact sparks.
- [ ] Add fragment burst or split-card mesh.
- [ ] Add ember/magic particle variant.
- [ ] Add camera focus during slain effect.
- [ ] Add slow-motion timing option for major cards.
- [ ] Add audio hook for slash impact.
- [ ] Move card to discard after slain effect completes.
- [ ] Ensure multiple destroyed cards can play sequentially or in grouped waves.
- [ ] Add reduced-motion fallback.
- [ ] Verify slain effect for Scorch.
- [ ] Verify slain effect for row Scorch variants.
- [ ] Verify slain effect for any future destroy ability.

## Phase 13: Other VFX

- [ ] Weather: Biting Frost.
- [ ] Weather: Impenetrable Fog.
- [ ] Weather: Torrential Rain.
- [ ] Clear Weather removal effect.
- [ ] Commander's Horn row pulse.
- [ ] Medic revive trail.
- [ ] Spy shadow transfer.
- [ ] Muster summon chain.
- [ ] Tight Bond link effect.
- [ ] Morale Boost row shimmer.
- [ ] Hero card immunity glint.
- [ ] Leader faction emblem burst.
- [ ] Round win board pulse.
- [ ] Match win cinematic.

## Phase 14: UI And HUD

- [ ] Main menu.
- [ ] Faction selection.
- [ ] Deck preview.
- [ ] Match loading screen.
- [ ] Opening redraw screen.
- [ ] In-match HUD.
- [ ] Player and opponent score display.
- [ ] Row score display.
- [ ] Round gems / round win markers.
- [ ] Hand count indicators.
- [ ] Deck and discard counts.
- [ ] Current turn indicator.
- [ ] Pass button.
- [ ] Leader ability button.
- [ ] Card inspection panel.
- [ ] Round result modal.
- [ ] Match result modal.
- [ ] Settings screen.
- [ ] Debug overlay.

## Phase 15: Debug Tools

- [ ] Start match with selected factions.
- [ ] Force player hand.
- [ ] Force opponent hand.
- [ ] Spawn card by ID.
- [ ] Trigger ability by ID.
- [ ] Trigger Scorch test.
- [ ] Trigger slain VFX test.
- [ ] Skip to round result.
- [ ] Show match state JSON.
- [ ] Show score breakdown.
- [ ] Toggle AI autoplay.
- [ ] Toggle animation speed.
- [ ] Toggle camera debug.
- [ ] Toggle hitbox/placement zone view.

## Phase 16: Testing

- [ ] Unit tests for match creation.
- [ ] Unit tests for shuffle/draw/redraw.
- [ ] Unit tests for passing.
- [ ] Unit tests for round resolution.
- [ ] Unit tests for each faction perk.
- [ ] Unit tests for each MVP ability.
- [ ] Unit tests for scoring modifiers.
- [ ] Unit tests for card persistence between rounds.
- [ ] Integration test for full match simulation.
- [ ] Integration test for AI completing a match.
- [ ] Browser smoke test for first load.
- [ ] Browser test for card hover/select/play.
- [ ] Browser test for pass flow.
- [ ] Browser test for round result.
- [ ] Browser visual check for slain VFX.
- [ ] Browser visual check for weather VFX.
- [ ] Performance check on mid-range desktop.

## Phase 17: Audio

- [ ] Card hover sound.
- [ ] Card draw sound.
- [ ] Card play sound.
- [ ] Pass sound.
- [ ] Round win/loss sound.
- [ ] Leader ability sound.
- [ ] Weather ambience.
- [ ] Scorch burn sound.
- [ ] Slain slash sound.
- [ ] UI click sounds.
- [ ] Audio settings.
- [ ] Mute toggle.

## Phase 18: Polish

- [ ] Improve board lighting.
- [ ] Improve card readability.
- [ ] Improve card material quality.
- [ ] Improve camera transitions.
- [ ] Improve faction selection presentation.
- [ ] Improve hand layout.
- [ ] Improve opponent side readability.
- [ ] Improve timing between chained animations.
- [ ] Improve VFX intensity balance.
- [ ] Improve mobile/tablet layout if in scope.
- [ ] Add loading progress.
- [ ] Add error fallback for missing assets.

## Phase 19: Packaging

- [ ] Production build.
- [ ] Asset compression.
- [ ] Texture optimization.
- [ ] Bundle analysis.
- [ ] Runtime performance pass.
- [ ] Static hosting verification.
- [ ] Document run/build commands.
- [ ] Document known limitations.
- [ ] Tag first playable milestone.

## Phase 20: Post-MVP

- [ ] Deck builder.
- [ ] Card collection.
- [ ] Skellige faction.
- [ ] Premium animated card art.
- [ ] Campaign mode.
- [ ] Challenge matches.
- [ ] Online multiplayer.
- [ ] Replay system.
- [ ] Save/load match.
- [ ] AI personalities.
- [ ] Additional board skins.
- [ ] Controller support.
