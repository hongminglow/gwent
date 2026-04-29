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

- Starter-deck factory adapter in `src/game/simulation/deckFactory.ts`.
- Match creation and turn flow in `src/game/simulation/matchFlow.ts`.
- Basic score snapshot in `src/game/simulation/scoring.ts`.
- Match-flow reducer integration in `src/game/simulation/reducer.ts`.
- Match-flow tests in `src/game/simulation/matchFlow.test.ts`.

## Phase 5: Scoring System

- [x] Calculate base unit strength.
- [x] Apply weather row strength.
- [x] Apply Clear Weather.
- [x] Apply Commander's Horn.
- [x] Apply Tight Bond.
- [x] Apply Morale Boost.
- [x] Apply hero immunity.
- [x] Apply row totals.
- [x] Apply player total.
- [x] Add score breakdown debug output.
- [x] Add tests for each scoring modifier.
- [x] Add tests for stacked modifiers.
- [x] Add tests for hero immunity against buffs and debuffs.

Phase 5 output:

- Breakdown-based scorer in `src/game/simulation/scoring.ts`.
- Scoring modifier tests in `src/game/simulation/scoring.test.ts`.
- Score order: weather, Tight Bond, Commander's Horn, then Morale Boost.
- Hero cards return base power and ignore weather, Horn, Tight Bond, and Morale Boost.

## Phase 6: Card Ability Engine

- [x] Implement ability resolver pipeline.
- [x] Implement target selection.
- [x] Implement immediate effects.
- [x] Implement delayed effects.
- [x] Implement ability event logging for renderer.
- [x] Implement `Spy`.
- [x] Implement `Medic`.
- [x] Implement `Muster`.
- [x] Implement `Morale Boost`.
- [x] Implement `Tight Bond`.
- [x] Implement `Scorch`.
- [x] Implement `Decoy`.
- [x] Implement `Weather`.
- [x] Implement `Clear Weather`.
- [x] Implement `Commander's Horn`.
- [x] Implement `Agile`.
- [x] Implement `Hero`.
- [x] Add complete ability tests.

Phase 6 output:

- Ability resolver pipeline in `src/game/simulation/abilityEngine.ts`.
- Card play flow delegates to the ability engine from `src/game/simulation/matchFlow.ts`.
- Persistent delayed effects are represented as serializable board state: weather flags, row Horn flags, and static row-card abilities.
- Renderer-facing ability events now include `card.played`, `card.drawn`, `card.revived`, `card.destroyed`, `weather.applied`, `weather.cleared`, and `row.buff.applied`.
- Ability tests live in `src/game/simulation/abilityEngine.test.ts`.

Post-MVP abilities:

- [ ] Implement `Summon Avenger`.
- [ ] Implement `Mardroeme`.
- [ ] Implement `Berserker`.
- [ ] Implement Skellige round-three graveyard return.

## Phase 7: Faction Data

- [x] Create Northern Realms faction definition.
- [x] Create Nilfgaardian Empire faction definition.
- [x] Create Scoia'tael faction definition.
- [x] Create Monsters faction definition.
- [x] Add faction perks.
- [x] Add leader card definitions.
- [x] Add starter deck for each faction.
- [x] Verify each starter deck has at least 22 unit cards.
- [x] Verify each starter deck has no more than 10 special cards.
- [x] Add neutral cards needed for MVP.
- [x] Add card art manifest keys.
- [x] Add VFX manifest keys.
- [x] Add card data validation script.

Phase 7 output:

- Curated MVP card definitions live in `src/game/data/cards.ts`.
- Starter deck definitions live in `src/game/data/starterDecks.ts`.
- Match creation now uses curated starter decks instead of generated placeholders.
- Card art and VFX placeholder asset keys are generated from the card data in `src/game/assets/manifest.ts`.
- Card data validation lives in `src/game/data/validateCardData.ts` and can be run with `npm run validate:data`.

## Phase 8: AI Opponent

- [x] Build legal action generator.
- [x] Build score projection helper.
- [x] Build simple card value evaluator.
- [x] Add pass decision logic.
- [x] Add round sacrifice logic.
- [x] Add leader ability usage logic.
- [x] Add Spy usage logic.
- [x] Add Medic usage logic.
- [x] Add Scorch usage logic.
- [x] Add Weather usage logic.
- [x] Add faction-specific priorities.
- [x] Add AI difficulty config.
- [x] Add AI autoplay debug mode.
- [x] Add simulation tests for AI actions.

Phase 8 output:

- AI legal action generation, scoring, action selection, and autoplay live in `src/game/simulation/aiOpponent.ts`.
- Leader abilities now resolve through the reducer via `use-leader`, including leader VFX events, weather leaders, and the Scoia'tael draw leader.
- AI difficulty tuning supports `easy`, `standard`, and `hard` profiles.
- AI autoplay can control the opponent only or both players for deterministic simulation/debug runs.
- AI tests live in `src/game/simulation/aiOpponent.test.ts`, including a full AI-vs-AI match completion test.

## Phase 9: Three.js Foundation

- [x] Create renderer bootstrap.
- [x] Create scene.
- [x] Create perspective camera.
- [x] Create camera rig.
- [x] Create WebGL renderer.
- [x] Create resize handling.
- [x] Create lighting setup.
- [x] Create 3D board/table.
- [x] Create row placement zones.
- [x] Create score plate anchors.
- [x] Create deck and discard pile anchors.
- [x] Create card mesh factory.
- [x] Create card material factory.
- [x] Create texture loader.
- [x] Add render loop.
- [x] Add debug camera mode.

Phase 9 output:

- Three.js app bootstrap, renderer setup, resize handling, render loop, context-loss recovery, and debug camera toggling live in `src/game/renderer/threeApp.ts`.
- Orbit-control debug camera rig lives in `src/game/renderer/cameraRig.ts`.
- Board/table geometry, row placement zones, score anchors, hand anchors, and deck/discard/leader anchors live in `src/game/renderer/boardScene.ts`.
- Card mesh creation lives in `src/game/renderer/cardMesh.ts`.
- Card material creation lives in `src/game/renderer/materials/cardMaterials.ts`.
- Texture loading and cache disposal live in `src/game/renderer/loaders/textureLoader.ts`.

## Phase 10: Renderer And Simulation Bridge

- [x] Subscribe renderer to simulation state snapshots.
- [x] Convert simulation card state into card meshes.
- [x] Convert simulation row state into board placement.
- [x] Play event-log animations in order.
- [x] Block player input while blocking animations play.
- [x] Emit player intents from renderer/UI.
- [x] Keep renderer objects out of simulation state.
- [x] Add animation queue.
- [x] Add skipped/fast animation mode for testing.

Phase 10 output:

- Match-state subscription and reducer dispatch live in `src/game/runtime/matchStore.ts`.
- The app now starts a real match from `src/main.ts` and routes HUD/keyboard intents through the reducer.
- Simulation snapshot to Three.js object mapping lives in `src/game/renderer/simulationBridge.ts`.
- Event-log animation sequencing and input blocking live in `src/game/renderer/animationQueue.ts`.
- The Three.js app exposes `applyMatchState` and `isInputBlocked` from `src/game/renderer/threeApp.ts`.
- The HUD now reflects live phase, turn, hand counts, score totals, and emits basic reducer intents from `src/game/ui/hud/createHud.ts`.
- Fast animation testing mode can be toggled with `F`; debug camera remains on backquote.

## Phase 11: Card Interaction

- [x] Raycast cards.
- [x] Hover lift animation.
- [x] Hover highlight.
- [x] Select card.
- [x] Inspect card.
- [x] Drag card to valid row.
- [x] Click card then click row placement.
- [x] Show valid placement zones.
- [x] Reject invalid placement with clear feedback.
- [x] Play card-to-row animation.
- [x] Animate draw from deck.
- [x] Animate discard movement.
- [x] Animate leader ability use.

Phase 11 output:

- Pointer-driven card interaction lives in `src/game/renderer/cardInteraction.ts`.
- The renderer now exposes card raycast targets, inspection data, and card interaction state from `src/game/renderer/simulationBridge.ts`.
- Row placement zones expose raycast targets and valid/hover/reject highlights from `src/game/renderer/boardScene.ts`.
- Card meshes now support hover, selected, dragging, and rejected glow states from `src/game/renderer/cardMesh.ts`.
- The HUD now shows live card inspection details and interaction feedback from `src/game/ui/hud/createHud.ts`.
- Interaction helper tests live in `src/game/renderer/cardInteraction.test.ts`.

## Phase 12: Slain / Slice VFX

- [x] Define destruction event type from simulation.
- [x] Add renderer animation contract for destroyed card IDs.
- [x] Create blade slash trail effect.
- [x] Add card cut line shader or decal.
- [x] Add impact sparks.
- [x] Add fragment burst or split-card mesh.
- [x] Add ember/magic particle variant.
- [x] Add camera focus during slain effect.
- [x] Add slow-motion timing option for major cards.
- [x] Add audio hook for slash impact.
- [x] Move card to discard after slain effect completes.
- [x] Ensure multiple destroyed cards can play sequentially or in grouped waves.
- [x] Add reduced-motion fallback.
- [x] Verify slain effect for Scorch.
- [x] Verify slain effect for row Scorch variants.
- [x] Verify slain effect for any future destroy ability.

Phase 12 output:

- Slain / slice VFX primitives and renderer event contract live in `src/game/renderer/vfx/slainEffect.ts`.
- `card.destroyed` events now use a dedicated blocking animation path in `src/game/renderer/simulationBridge.ts`.
- Destroyed cards stay at their pre-destruction board pose during the slash, then travel to discard on completion.
- Slain events request a short camera focus pulse through `src/game/renderer/cameraRig.ts`.
- Slain events emit the `oathbound:audio-cue` browser event with a `slain-slash` cue payload.
- Reduced-motion users get a short discard transition without the slash particle burst.
- Contract and VFX construction tests live in `src/game/renderer/vfx/slainEffect.test.ts`.

## Phase 13: Other VFX

- [x] Weather: Biting Frost.
- [x] Weather: Impenetrable Fog.
- [x] Weather: Torrential Rain.
- [x] Clear Weather removal effect.
- [x] Commander's Horn row pulse.
- [x] Medic revive trail.
- [x] Spy shadow transfer.
- [x] Muster summon chain.
- [x] Tight Bond link effect.
- [x] Morale Boost row shimmer.
- [x] Hero card immunity glint.
- [x] Leader faction emblem burst.
- [x] Round win board pulse.
- [x] Match win cinematic.

Phase 13 output:

- Ability/event VFX routing lives in `src/game/renderer/vfx/abilityEventEffects.ts`.
- Weather VFX now distinguish close-row frost, ranged-row fog, and siege-row rain from simulation `weather.applied` events.
- Clear Weather, Commander's Horn, Medic, Spy, Muster, Tight Bond, Morale Boost, Hero, Leader, round win, and match win events now create dedicated transient Three.js effects.
- `src/game/renderer/simulationBridge.ts` now creates and disposes ability VFX inside the event animation queue.
- Event durations were tuned so ability VFX have enough time to read without changing simulation rules.
- Ability VFX tests live in `src/game/renderer/vfx/abilityEventEffects.test.ts`.

## Phase 14: UI And HUD

- [x] Main menu.
- [x] Faction selection.
- [x] Deck preview.
- [x] Match loading screen.
- [x] Opening redraw screen.
- [x] In-match HUD.
- [x] Player and opponent score display.
- [x] Row score display.
- [x] Round gems / round win markers.
- [x] Hand count indicators.
- [x] Deck and discard counts.
- [x] Current turn indicator.
- [x] Pass button.
- [x] Leader ability button.
- [x] Card inspection panel.
- [x] Round result modal.
- [x] Match result modal.
- [x] Settings screen.
- [x] Debug overlay.

Phase 14 output:

- Main menu, faction choice, deck preview model, and match loading UI live in `src/game/ui/menu/`.
- `src/main.ts` now manages disposable match sessions so the player starts from faction select and can return to menu after a match.
- `src/game/ui/hud/createHud.ts` now owns redraw card buttons, score chips, row score panels, round win gems, leader/pass controls, result modals, settings, card inspection, and debug readouts.
- `src/game/renderer/threeApp.ts` exposes HUD-controlled fast animation and debug camera toggles.
- `src/style.css` now contains the responsive fantasy card-game UI theme for menu, HUD, redraw, modals, settings, and debug surfaces.

## Phase 15: Debug Tools

- [x] Start match with selected factions.
- [x] Force player hand.
- [x] Force opponent hand.
- [x] Spawn card by ID.
- [x] Trigger ability by ID.
- [x] Trigger Scorch test.
- [x] Trigger slain VFX test.
- [x] Skip to round result.
- [x] Show match state JSON.
- [x] Show score breakdown.
- [x] Toggle AI autoplay.
- [x] Toggle animation speed.
- [x] Toggle camera debug.
- [x] Toggle hitbox/placement zone view.

Phase 15 output:

- Debug match actions now live in `src/game/simulation/debugTools.ts` and are routed through `src/game/simulation/reducer.ts`.
- The HUD Debug drawer in `src/game/ui/hud/createHud.ts` can start selected-faction matches, force hands, spawn cards, trigger ability/scenario shortcuts, inspect state JSON, inspect score breakdowns, toggle AI autoplay, and toggle hitbox zones.
- `src/main.ts` now supports HUD-controlled selected opponent factions and AI autoplay.
- `src/game/renderer/threeApp.ts` and `src/game/renderer/boardScene.ts` expose placement-zone visibility for hitbox debugging.
- Debug tool regression tests live in `src/game/simulation/debugTools.test.ts`.

## Phase 16: Testing

- [x] Unit tests for match creation.
- [x] Unit tests for shuffle/draw/redraw.
- [x] Unit tests for passing.
- [x] Unit tests for round resolution.
- [x] Unit tests for each faction perk.
- [x] Unit tests for each MVP ability.
- [x] Unit tests for scoring modifiers.
- [x] Unit tests for card persistence between rounds.
- [x] Integration test for full match simulation.
- [x] Integration test for AI completing a match.
- [x] Browser smoke test for first load.
- [x] Browser test for card hover/select/play.
- [x] Browser test for pass flow.
- [x] Browser test for round result.
- [x] Browser visual check for slain VFX.
- [x] Browser visual check for weather VFX.
- [x] Performance check on mid-range desktop.

Phase 16 output:

- Match-flow regression coverage was expanded in `src/game/simulation/matchFlow.test.ts` for deterministic shuffle/draw, redraw budget, faction perks, round cleanup, card persistence, and a scripted full match.
- Existing ability, scoring, AI, debug-tools, renderer interaction, and VFX test suites remain part of the full Phase 16 test pass.
- Northern Realms now draws its faction bonus card after winning a non-final round.
- Renderer input-block synchronization now clears correctly after fast blocking animations, preventing the HUD from getting stuck in an animation-blocked state after card play.
- Browser QA covered first load, card hover/select/play, pass flow, round result modal, slain/weather VFX cues, and mobile viewport sanity. Screenshots were saved under `.codex/phase16-*.png`.
- Headless Chromium performance sampling completed but measured low FPS in this environment: about 8.15 FPS average, p95 frame time about 133.4 ms, and 179/180 sampled frames above 33 ms. Treat runtime performance as a Phase 18/19 optimization risk, not as a gameplay-rule blocker.

## Phase 17: Audio

- [x] Card hover sound.
- [x] Card draw sound.
- [x] Card play sound.
- [x] Pass sound.
- [x] Round win/loss sound.
- [x] Leader ability sound.
- [x] Weather ambience.
- [x] Scorch burn sound.
- [x] Slain slash sound.
- [x] UI click sounds.
- [x] Audio settings.
- [x] Mute toggle.

Phase 17 output:

- Web Audio synthesis lives in `src/game/audio/audioEngine.ts`; it creates distinct procedural cue profiles for UI clicks, card hover/draw/play, pass, leader, weather, Horn, Medic, Muster, Spy, Scorch, slain slash, round outcomes, and match outcomes.
- Simulation event routing now maps match events into audio cues without putting audio state inside the simulation model.
- Renderer cue routing now sends card-hover and slain-slash cues through the Three.js app into the audio engine while keeping the existing `oathbound:audio-cue` diagnostic browser event.
- Weather ambience starts while weather rows are active and fades out when weather clears or audio is muted.
- The Settings drawer now includes a master volume slider and mute toggle.
- Audio cue routing tests live in `src/game/audio/audioEngine.test.ts`.
- Browser QA confirmed settings controls, UI click cues, card-play cues, pass cue, weather ambience, and slain slash diagnostics. Screenshots were saved under `.codex/phase17-audio-*.png`.

## Phase 18: Polish

- [x] Improve board lighting.
- [x] Improve card readability.
- [x] Improve card material quality.
- [x] Improve camera transitions.
- [x] Improve faction selection presentation.
- [x] Improve hand layout.
- [x] Improve opponent side readability.
- [x] Improve timing between chained animations.
- [x] Improve VFX intensity balance.
- [x] Improve mobile/tablet layout if in scope.
- [x] Add loading progress.
- [x] Add error fallback for missing assets.

Phase 18 output:

- Board lighting now uses hemisphere, key, rim, card-fill, and row-glow lights with tuned fog/exposure for clearer card silhouettes.
- Card meshes now generate richer fallback face art, stronger captions, power labels, and refined materials for better tabletop readability before final card art exists.
- Camera rig focus pulses are smoother, viewport-aware, and better framed on desktop and tall/mobile screens.
- Hand placement spacing, scale, and fan angles were tuned so player cards stay readable above the bottom HUD while preserving opponent readability.
- Animation durations were slightly lengthened for draw/play/leader/weather/round events so chained effects read less abruptly.
- Weather and slain VFX intensity was reduced to avoid hiding card state while still reading as cinematic.
- Main menu faction cards now have faction crests, stronger selection treatment, and a faction-marked deck preview.
- Match loading now shows staged progress, and match startup failures fall back to a recoverable menu error overlay.
- Texture loading now creates an in-engine missing-art fallback texture and logs the missing asset path.
- The app now ships an inline favicon so browser smoke tests do not hit a default missing favicon request.
- Mobile and short-height HUD breakpoints were tightened to preserve the center playfield.

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
