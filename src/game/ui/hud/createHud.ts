import { ALL_CARD_DEFINITIONS } from "../../data/cards";
import { FACTIONS } from "../../data/factions";
import { debugFlags } from "../../diagnostics/debugFlags";
import { createImmediateAction, type CardInteractionHudState } from "../../renderer/cardInteraction";
import type { GameAction } from "../../simulation/actions";
import { chooseAiAction } from "../../simulation/aiOpponent";
import { DEBUG_HAND_PRESETS } from "../../simulation/debugTools";
import { calculateScoreBreakdown } from "../../simulation/scoring";
import type {
  AbilityId,
  CardDefinition,
  CardInstanceId,
  FactionId,
  GameEvent,
  MatchState,
  PlayerId,
  RowId,
} from "../../simulation/types";

export type Hud = {
  dispose: () => void;
  setInteraction: (interaction: CardInteractionHudState) => void;
  update: (state: MatchState, inputBlocked: boolean, interaction?: CardInteractionHudState) => void;
};

export type HudOptions = {
  onDebugStartMatch?: (playerFactionId: FactionId, opponentFactionId: FactionId) => void;
  onExitToMenu?: () => void;
  onIntent: (action: GameAction) => void;
  onToggleAiAutoplay?: (enabled: boolean) => void;
  onToggleDebugCamera?: (enabled: boolean) => void;
  onToggleFastAnimations?: (enabled: boolean) => void;
  onTogglePlacementZones?: (enabled: boolean) => void;
};

const ROWS: RowId[] = ["close", "ranged", "siege"];
const ABILITIES: AbilityId[] = [
  "agile",
  "clear-weather",
  "commanders-horn",
  "decoy",
  "hero",
  "medic",
  "morale-boost",
  "muster",
  "scorch",
  "spy",
  "tight-bond",
  "weather",
];

export function createHud(root: HTMLElement, state: MatchState, options: HudOptions): Hud {
  const shell = document.createElement("main");
  shell.className = "app-shell";

  const hud = document.createElement("section");
  hud.className = "hud";
  hud.setAttribute("aria-label", "Match HUD");

  const status = document.createElement("div");
  status.className = "hud__status";
  const title = document.createElement("h1");
  title.className = "hud__title";
  title.textContent = "Oathbound";
  const phase = document.createElement("p");
  phase.className = "hud__meta";
  const detail = document.createElement("p");
  detail.className = "hud__meta";
  status.append(title, phase, detail);

  const rounds = document.createElement("div");
  rounds.className = "hud__rounds";
  rounds.setAttribute("aria-label", "Round wins");

  const controls = document.createElement("div");
  controls.className = "hud__controls";
  const finishRedrawButton = createButton("Finish Redraw");
  const suggestedButton = createButton("Play Suggested");
  const leaderButton = createButton("Leader");
  const passButton = createButton("Pass");
  const aiStepButton = createButton("AI Step");
  const settingsButton = createButton("Settings");
  const debugButton = createButton("Debug");
  const menuButton = createButton("Menu");
  controls.append(
    finishRedrawButton,
    suggestedButton,
    leaderButton,
    passButton,
    aiStepButton,
    settingsButton,
    debugButton,
    menuButton,
  );

  const rowScores = document.createElement("section");
  rowScores.className = "hud__rows";
  rowScores.setAttribute("aria-label", "Row scores");

  const strip = document.createElement("div");
  strip.className = "hud__strip";
  strip.setAttribute("aria-label", "Match state");
  const phaseChip = createChip("Phase");
  const turnChip = createChip("Turn");
  const playerScoreChip = createChip("Player");
  const opponentScoreChip = createChip("Opponent");
  const handChip = createChip("Hand");
  const deckChip = createChip("Deck");
  const discardChip = createChip("Discard");
  strip.append(
    phaseChip.root,
    turnChip.root,
    playerScoreChip.root,
    opponentScoreChip.root,
    handChip.root,
    deckChip.root,
    discardChip.root,
  );

  const redrawPanel = document.createElement("aside");
  redrawPanel.className = "hud__redraw";
  redrawPanel.setAttribute("aria-label", "Opening redraw");

  const hint = document.createElement("div");
  hint.className = "hud__hint";

  const inspect = document.createElement("aside");
  inspect.className = "hud__inspect";
  inspect.setAttribute("aria-label", "Card inspection");
  const inspectTitle = document.createElement("h2");
  inspectTitle.className = "hud__inspect-title";
  const inspectMeta = document.createElement("p");
  inspectMeta.className = "hud__inspect-meta";
  const inspectAbilities = document.createElement("p");
  inspectAbilities.className = "hud__inspect-meta";
  inspect.append(inspectTitle, inspectMeta, inspectAbilities);

  const modal = document.createElement("section");
  modal.className = "hud__modal";
  modal.setAttribute("aria-label", "Match result");
  modal.hidden = true;

  const settingsDrawer = createSettingsDrawer({
    onDebugCameraChange: (enabled) => {
      debugFlags.debugCamera = enabled;
      options.onToggleDebugCamera?.(enabled);
    },
    onFastAnimationsChange: (enabled) => {
      debugFlags.fastAnimations = enabled;
      options.onToggleFastAnimations?.(enabled);
    },
    onShowDebugChange: (enabled) => {
      debugFlags.showPerf = enabled;
      debugOverlayVisible = enabled;
      renderDebugOverlay(latestState, latestInputBlocked, latestInteraction);
    },
  });

  const debugToolsDrawer = createDebugToolsDrawer({
    onDebugStartMatch: (playerFactionId, opponentFactionId) => {
      options.onDebugStartMatch?.(playerFactionId, opponentFactionId);
    },
    onIntent: options.onIntent,
    onToggleAiAutoplay: (enabled) => {
      debugAiAutoplayEnabled = enabled;
      options.onToggleAiAutoplay?.(enabled);
      renderDebugToolsDrawer();
    },
    onTogglePlacementZones: (enabled) => {
      debugFlags.showPlacementZones = enabled;
      options.onTogglePlacementZones?.(enabled);
      renderDebugToolsDrawer();
    },
  });

  const debugOverlay = document.createElement("aside");
  debugOverlay.className = "hud__debug";
  debugOverlay.setAttribute("aria-label", "Debug overlay");
  debugOverlay.hidden = true;

  hud.append(
    status,
    rounds,
    controls,
    rowScores,
    strip,
    redrawPanel,
    inspect,
    hint,
    modal,
    settingsDrawer.root,
    debugToolsDrawer.root,
    debugOverlay,
  );
  shell.appendChild(hud);
  root.appendChild(shell);

  let latestState = state;
  let latestInputBlocked = false;
  let latestInteraction: CardInteractionHudState = {
    validRows: [],
  };
  let dismissedRoundSequence = -1;
  let settingsOpen = false;
  let debugToolsOpen = false;
  let debugAiAutoplayEnabled = false;
  let debugOverlayVisible = debugFlags.showPerf;

  finishRedrawButton.addEventListener("click", () => {
    const playerId = getNextRedrawPlayer(latestState);

    if (playerId && !latestInputBlocked) {
      options.onIntent({
        type: "finish-redraw",
        playerId,
      });
    }
  });

  suggestedButton.addEventListener("click", () => {
    const action = getSuggestedAction(latestState);

    if (action && !latestInputBlocked) {
      options.onIntent(action);
    }
  });

  leaderButton.addEventListener("click", () => {
    const action = getLeaderAction(latestState);

    if (action && !latestInputBlocked) {
      options.onIntent(action);
    }
  });

  passButton.addEventListener("click", () => {
    if (latestState.phase === "playing" && !latestInputBlocked) {
      options.onIntent({
        type: "pass-round",
        playerId: latestState.round.activePlayerId,
      });
    }
  });

  aiStepButton.addEventListener("click", () => {
    const action = getSuggestedAction(latestState);

    if (action && !latestInputBlocked) {
      options.onIntent(action);
    }
  });

  settingsButton.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    if (settingsOpen) {
      debugToolsOpen = false;
    }
    renderSettingsDrawer();
    renderDebugToolsDrawer();
  });

  debugButton.addEventListener("click", () => {
    debugToolsOpen = !debugToolsOpen;
    if (debugToolsOpen) {
      settingsOpen = false;
    }
    renderSettingsDrawer();
    renderDebugToolsDrawer();
  });

  menuButton.addEventListener("click", () => {
    options.onExitToMenu?.();
  });

  const renderSettingsDrawer = () => {
    settingsDrawer.root.hidden = !settingsOpen;
    settingsDrawer.fastAnimationsInput.checked = debugFlags.fastAnimations;
    settingsDrawer.debugCameraInput.checked = debugFlags.debugCamera;
    settingsDrawer.showDebugInput.checked = debugFlags.showPerf;
  };

  const renderDebugToolsDrawer = () => {
    debugToolsDrawer.root.hidden = !debugToolsOpen;
    debugToolsDrawer.update(latestState, {
      aiAutoplayEnabled: debugAiAutoplayEnabled,
      placementZonesVisible: debugFlags.showPlacementZones,
    });
  };

  const renderDebugOverlay = (
    nextState: MatchState,
    inputBlocked: boolean,
    interaction: CardInteractionHudState,
  ) => {
    debugOverlay.hidden = !debugOverlayVisible;

    if (!debugOverlayVisible) {
      return;
    }

    debugOverlay.replaceChildren(
      createDebugLine("Match", nextState.id),
      createDebugLine("Phase", nextState.phase),
      createDebugLine("Round", `${nextState.round.number}`),
      createDebugLine("Active", formatPlayer(nextState.round.activePlayerId)),
      createDebugLine("Events", `${nextState.eventLog.length}`),
      createDebugLine("Input", inputBlocked ? "Blocked" : "Ready"),
      createDebugLine("Rows", `${interaction.validRows.length}`),
      createDebugLine("Camera", debugFlags.debugCamera ? "Debug" : "Board"),
      createDebugLine("Fast VFX", debugFlags.fastAnimations ? "On" : "Off"),
    );
  };

  const update = (
    nextState: MatchState,
    inputBlocked: boolean,
    interaction?: CardInteractionHudState,
  ) => {
    latestState = nextState;
    latestInputBlocked = inputBlocked;
    latestInteraction = interaction ?? latestInteraction;
    const scoreBreakdown = calculateScoreBreakdown(nextState);
    const activePlayer = nextState.round.activePlayerId;
    const activeFaction = nextState.players[activePlayer].factionId;
    const suggestedAction = getSuggestedAction(nextState);
    const leaderAction = getLeaderAction(nextState);
    const redrawPlayer = getNextRedrawPlayer(nextState);

    phase.textContent = `Phase 15 debug tools. ${formatPhase(nextState.phase)}.`;
    detail.textContent = `${formatFaction(nextState.players.player.factionId)} vs ${formatFaction(
      nextState.players.opponent.factionId,
    )}. Active: ${formatPlayer(activePlayer)} / ${formatFaction(activeFaction)}. Round ${nextState.round.number}.`;
    phaseChip.value.textContent = formatPhase(nextState.phase);
    turnChip.value.textContent = nextState.phase === "match-complete"
      ? formatWinner(nextState.winnerId ? [nextState.winnerId] : [])
      : formatPlayer(activePlayer);
    playerScoreChip.value.textContent = `${scoreBreakdown.player.total}`;
    opponentScoreChip.value.textContent = `${scoreBreakdown.opponent.total}`;
    handChip.value.textContent = `${nextState.players.player.hand.cards.length} / ${nextState.players.opponent.hand.cards.length}`;
    deckChip.value.textContent = `${nextState.players.player.deck.cards.length} / ${nextState.players.opponent.deck.cards.length}`;
    discardChip.value.textContent = `${nextState.players.player.discard.cards.length} / ${nextState.players.opponent.discard.cards.length}`;

    renderRoundMarkers(rounds, nextState);
    renderRowScores(rowScores, nextState);
    renderRedrawPanel(redrawPanel, nextState, inputBlocked, options.onIntent);
    renderModal(modal, nextState, {
      dismissedRoundSequence,
      onDismissRound: (sequence) => {
        dismissedRoundSequence = sequence;
        update(latestState, latestInputBlocked, latestInteraction);
      },
      onExitToMenu: options.onExitToMenu,
    });
    updateInspection(inspect, inspectTitle, inspectMeta, inspectAbilities, latestInteraction);
    hint.textContent = getHintText(inputBlocked, latestInteraction, nextState);

    finishRedrawButton.textContent = redrawPlayer ? `Finish ${formatPlayer(redrawPlayer)} Redraw` : "Finish Redraw";
    finishRedrawButton.disabled = inputBlocked || nextState.phase !== "redraw" || !redrawPlayer;
    suggestedButton.disabled = inputBlocked || !suggestedAction;
    leaderButton.disabled = inputBlocked || !leaderAction;
    leaderButton.textContent = getLeaderButtonLabel(nextState);
    passButton.disabled = inputBlocked || nextState.phase !== "playing" || nextState.players[activePlayer].hasPassed;
    aiStepButton.disabled = inputBlocked || !suggestedAction;
    menuButton.disabled = inputBlocked && nextState.phase !== "match-complete";
    settingsButton.setAttribute("aria-expanded", String(settingsOpen));
    debugButton.setAttribute("aria-expanded", String(debugToolsOpen));
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    renderDebugOverlay(nextState, inputBlocked, latestInteraction);
  };

  update(state, false);

  return {
    dispose() {
      shell.remove();
    },
    setInteraction(interaction) {
      update(latestState, latestInputBlocked, interaction);
    },
    update,
  };
}

function createSettingsDrawer(options: {
  onDebugCameraChange: (enabled: boolean) => void;
  onFastAnimationsChange: (enabled: boolean) => void;
  onShowDebugChange: (enabled: boolean) => void;
}) {
  const root = document.createElement("aside");
  root.className = "hud__drawer";
  root.hidden = true;
  root.setAttribute("aria-label", "Settings");

  const title = document.createElement("h2");
  title.className = "hud__drawer-title";
  title.textContent = "Settings";
  const fastAnimations = createToggle("Fast animations", debugFlags.fastAnimations);
  const debugCamera = createToggle("Debug camera", debugFlags.debugCamera);
  const showDebug = createToggle("Debug overlay", debugFlags.showPerf);

  fastAnimations.input.addEventListener("change", () => {
    options.onFastAnimationsChange(fastAnimations.input.checked);
  });
  debugCamera.input.addEventListener("change", () => {
    options.onDebugCameraChange(debugCamera.input.checked);
  });
  showDebug.input.addEventListener("change", () => {
    options.onShowDebugChange(showDebug.input.checked);
  });

  root.append(title, fastAnimations.root, debugCamera.root, showDebug.root);

  return {
    debugCameraInput: debugCamera.input,
    fastAnimationsInput: fastAnimations.input,
    root,
    showDebugInput: showDebug.input,
  };
}

function createDebugToolsDrawer(options: {
  onDebugStartMatch: (playerFactionId: FactionId, opponentFactionId: FactionId) => void;
  onIntent: (action: GameAction) => void;
  onToggleAiAutoplay: (enabled: boolean) => void;
  onTogglePlacementZones: (enabled: boolean) => void;
}) {
  const root = document.createElement("aside");
  root.className = "hud__debug-tools";
  root.hidden = true;
  root.setAttribute("aria-label", "Debug tools");

  const title = document.createElement("h2");
  title.className = "hud__drawer-title";
  title.textContent = "Debug Tools";

  const matchGroup = createDebugGroup("Match");
  const playerFactionSelect = createSelect("Debug player faction", FACTIONS.map((faction) => ({
    label: faction.name,
    value: faction.id,
  })));
  const opponentFactionSelect = createSelect("Debug opponent faction", FACTIONS.map((faction) => ({
    label: faction.name,
    value: faction.id,
  })));
  opponentFactionSelect.value = "monsters";
  const startMatchButton = createDebugButton("Start Match");
  startMatchButton.addEventListener("click", () => {
    const playerFactionId = getFactionId(playerFactionSelect.value) ?? "northern-realms";
    let opponentFactionId = getFactionId(opponentFactionSelect.value) ?? "monsters";

    if (opponentFactionId === playerFactionId) {
      opponentFactionId = FACTIONS.find((faction) => faction.id !== playerFactionId)?.id ?? "monsters";
    }

    options.onDebugStartMatch(playerFactionId, opponentFactionId);
  });
  matchGroup.append(
    createDebugField("Player", playerFactionSelect),
    createDebugField("Opponent", opponentFactionSelect),
    startMatchButton,
  );

  const stateGroup = createDebugGroup("State");
  const playerTargetSelect = createSelect("Debug target player", [
    { label: "Player", value: "player" },
    { label: "Opponent", value: "opponent" },
  ]);
  const rowSelect = createSelect("Debug target row", ROWS.map((rowId) => ({
    label: formatRow(rowId),
    value: rowId,
  })));
  const cardSelect = createSelect("Debug card ID", ALL_CARD_DEFINITIONS.map((definition) => ({
    label: `${definition.name} (${definition.id})`,
    value: definition.id,
  })));
  cardSelect.value = "neutral-scorch";
  const abilitySelect = createSelect("Debug ability ID", ABILITIES.map((abilityId) => ({
    label: formatAbility(abilityId),
    value: abilityId,
  })));
  abilitySelect.value = "weather";
  const forcePlayerHandButton = createDebugButton("Force Player Hand");
  forcePlayerHandButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-force-hand",
      definitionIds: DEBUG_HAND_PRESETS.player,
      playerId: "player",
    });
  });
  const forceOpponentHandButton = createDebugButton("Force Opponent Hand");
  forceOpponentHandButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-force-hand",
      definitionIds: DEBUG_HAND_PRESETS.opponent,
      playerId: "opponent",
    });
  });
  const spawnHandButton = createDebugButton("Spawn To Hand");
  spawnHandButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-spawn-card",
      definitionId: cardSelect.value,
      playerId: getPlayerId(playerTargetSelect.value) ?? "player",
      zone: "hand",
    });
  });
  const spawnBoardButton = createDebugButton("Spawn To Board");
  spawnBoardButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-spawn-card",
      definitionId: cardSelect.value,
      playerId: getPlayerId(playerTargetSelect.value) ?? "player",
      rowId: getRowId(rowSelect.value) ?? "close",
      zone: "board",
    });
  });
  const triggerAbilityButton = createDebugButton("Trigger Ability");
  triggerAbilityButton.addEventListener("click", () => {
    const abilityId = getAbilityId(abilitySelect.value);

    if (!abilityId) {
      return;
    }

    options.onIntent({
      type: "debug-trigger-ability",
      abilityId,
      playerId: getPlayerId(playerTargetSelect.value) ?? "player",
      rowId: getRowId(rowSelect.value) ?? "close",
    });
  });
  stateGroup.append(
    createDebugField("Target", playerTargetSelect),
    createDebugField("Row", rowSelect),
    createDebugField("Card", cardSelect),
    createDebugField("Ability", abilitySelect),
    createDebugButtonRow(forcePlayerHandButton, forceOpponentHandButton),
    createDebugButtonRow(spawnHandButton, spawnBoardButton),
    triggerAbilityButton,
  );

  const scenariosGroup = createDebugGroup("Scenarios");
  const scorchButton = createDebugButton("Scorch Test");
  scorchButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-trigger-scorch",
      playerId: getPlayerId(playerTargetSelect.value) ?? "player",
      rowId: getRowId(rowSelect.value) ?? "close",
    });
  });
  const slainButton = createDebugButton("Slain VFX Test");
  slainButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-trigger-slain",
      playerId: getPlayerId(playerTargetSelect.value) ?? "player",
      rowId: getRowId(rowSelect.value) ?? "close",
    });
  });
  const skipRoundButton = createDebugButton("Skip Round Result");
  skipRoundButton.addEventListener("click", () => {
    options.onIntent({
      type: "debug-skip-round",
      winnerId: getPlayerId(playerTargetSelect.value),
    });
  });
  const aiAutoplay = createToggle("AI autoplay", false);
  aiAutoplay.input.addEventListener("change", () => {
    options.onToggleAiAutoplay(aiAutoplay.input.checked);
  });
  const placementZones = createToggle("Hitbox zones", debugFlags.showPlacementZones);
  placementZones.input.addEventListener("change", () => {
    options.onTogglePlacementZones(placementZones.input.checked);
  });
  scenariosGroup.append(
    createDebugButtonRow(scorchButton, slainButton),
    skipRoundButton,
    aiAutoplay.root,
    placementZones.root,
  );

  const outputGroup = createDebugGroup("Readout");
  const outputModeSelect = createSelect("Debug output mode", [
    { label: "Score Breakdown", value: "score" },
    { label: "Match State JSON", value: "state" },
  ]);
  const output = document.createElement("pre");
  output.className = "hud__debug-output";
  outputGroup.append(createDebugField("Show", outputModeSelect), output);
  outputModeSelect.addEventListener("change", () => {
    output.dataset.mode = outputModeSelect.value;
  });

  root.append(title, matchGroup, stateGroup, scenariosGroup, outputGroup);

  return {
    root,
    update(state: MatchState, flags: {
      aiAutoplayEnabled: boolean;
      placementZonesVisible: boolean;
    }) {
      aiAutoplay.input.checked = flags.aiAutoplayEnabled;
      placementZones.input.checked = flags.placementZonesVisible;
      output.textContent = outputModeSelect.value === "state"
        ? JSON.stringify(state, null, 2)
        : formatScoreBreakdown(state);
    },
  };
}

function createToggle(label: string, checked: boolean): { input: HTMLInputElement; root: HTMLLabelElement } {
  const root = document.createElement("label");
  root.className = "hud__toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const text = document.createElement("span");
  text.textContent = label;
  root.append(input, text);
  return {
    input,
    root,
  };
}

function createDebugGroup(title: string): HTMLElement {
  const group = document.createElement("section");
  group.className = "hud__debug-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.appendChild(heading);
  return group;
}

function createDebugField(label: string, control: HTMLElement): HTMLElement {
  const field = document.createElement("label");
  field.className = "hud__debug-field";
  const text = document.createElement("span");
  text.textContent = label;
  field.append(text, control);
  return field;
}

function createSelect(
  label: string,
  options: Array<{ label: string; value: string }>,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "hud__debug-select";
  select.setAttribute("aria-label", label);

  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  }

  return select;
}

function createDebugButton(label: string): HTMLButtonElement {
  const button = createButton(label);
  button.classList.add("hud__button--debug");
  return button;
}

function createDebugButtonRow(...buttons: HTMLButtonElement[]): HTMLElement {
  const row = document.createElement("div");
  row.className = "hud__debug-button-row";
  row.append(...buttons);
  return row;
}

function renderRoundMarkers(root: HTMLElement, state: MatchState) {
  root.replaceChildren(
    createRoundTrack("Player", state.players.player.roundWins),
    createRoundTrack("Opponent", state.players.opponent.roundWins),
  );
}

function createRoundTrack(label: string, wins: number): HTMLElement {
  const track = document.createElement("div");
  track.className = "hud__round-track";
  const text = document.createElement("span");
  text.textContent = label;
  const gems = document.createElement("span");
  gems.className = "hud__gems";

  for (let index = 0; index < 2; index += 1) {
    const gem = document.createElement("span");
    gem.className = "hud__gem";
    gem.classList.toggle("hud__gem--won", index < wins);
    gems.appendChild(gem);
  }

  track.append(text, gems);
  return track;
}

function renderRowScores(root: HTMLElement, state: MatchState) {
  const breakdown = calculateScoreBreakdown(state);
  root.replaceChildren(
    createPlayerRows(state, "opponent", breakdown.opponent.total),
    createPlayerRows(state, "player", breakdown.player.total),
  );
}

function createPlayerRows(state: MatchState, playerId: PlayerId, total: number): HTMLElement {
  const group = document.createElement("div");
  group.className = "hud__row-group";
  const header = document.createElement("div");
  header.className = "hud__row-header";
  header.innerHTML = `<span>${formatPlayer(playerId)}</span><strong>${total}</strong>`;
  group.appendChild(header);

  const breakdown = calculateScoreBreakdown(state)[playerId];

  for (const rowId of ROWS) {
    const row = breakdown.rows[rowId];
    const item = document.createElement("div");
    item.className = "hud__row-score";
    item.innerHTML = `
      <span>${formatRow(rowId)}</span>
      <span>${row.cards.length} cards</span>
      <strong>${row.total}</strong>
    `;

    if (row.weatherActive || row.hornActive) {
      const badges = document.createElement("span");
      badges.className = "hud__row-badges";

      if (row.weatherActive) {
        badges.appendChild(createBadge("Weather"));
      }

      if (row.hornActive) {
        badges.appendChild(createBadge("Horn"));
      }

      item.appendChild(badges);
    }

    group.appendChild(item);
  }

  return group;
}

function renderRedrawPanel(
  root: HTMLElement,
  state: MatchState,
  inputBlocked: boolean,
  onIntent: (action: GameAction) => void,
) {
  root.hidden = state.phase !== "redraw";

  if (state.phase !== "redraw") {
    root.replaceChildren();
    return;
  }

  const player = state.players.player;
  const isPlayerRedrawOpen = !player.hand.redrawComplete && player.hand.redrawsRemaining > 0;
  const header = document.createElement("div");
  header.className = "hud__redraw-header";
  header.innerHTML = `
    <div>
      <span class="hud__eyebrow">Opening Redraw</span>
      <h2>Choose cards to replace</h2>
    </div>
    <strong>${player.hand.redrawsRemaining} left</strong>
  `;

  const meta = document.createElement("p");
  meta.className = "hud__redraw-meta";
  meta.textContent = player.hand.redrawComplete
    ? "Your redraw is locked. Finish the opponent redraw to enter the first round."
    : "Redrawn cards return to the deck and are replaced from the top.";

  const cards = document.createElement("div");
  cards.className = "hud__redraw-cards";

  for (const cardInstanceId of player.hand.cards) {
    const card = state.cards[cardInstanceId];
    const definition = state.cardDefinitions[card.definitionId];
    const button = document.createElement("button");
    button.className = "hud__redraw-card";
    button.type = "button";
    button.disabled = inputBlocked || !isPlayerRedrawOpen;
    button.innerHTML = `
      <span>${definition.name}</span>
      <strong>${definition.type === "special" ? "Special" : definition.basePower}</strong>
      <small>${formatAbilities(definition.abilities)}</small>
    `;
    button.addEventListener("click", () => {
      if (!button.disabled) {
        onIntent({
          type: "redraw-card",
          playerId: "player",
          cardInstanceId,
        });
      }
    });
    cards.appendChild(button);
  }

  root.replaceChildren(header, meta, cards);
}

function renderModal(
  root: HTMLElement,
  state: MatchState,
  options: {
    dismissedRoundSequence: number;
    onDismissRound: (sequence: number) => void;
    onExitToMenu?: () => void;
  },
) {
  const matchEvent = getLatestEvent(state, "match.ended");

  if (matchEvent) {
    const winnerId = isPlayerId(matchEvent.payload.winnerId) ? matchEvent.payload.winnerId : state.winnerId;
    renderResultPanel(root, {
      actions: [
        {
          label: "Return to Menu",
          onClick: () => options.onExitToMenu?.(),
        },
      ],
      meta: winnerId === "player" ? "Victory secured." : "Opponent takes the match.",
      title: `${formatWinner(winnerId ? [winnerId] : [])} wins the match`,
    });
    return;
  }

  const roundEvent = getLatestEvent(state, "round.ended");

  if (!roundEvent || roundEvent.sequence <= options.dismissedRoundSequence) {
    root.hidden = true;
    root.replaceChildren();
    return;
  }

  const scores = getRoundScores(roundEvent);
  const winnerIds = getWinnerIds(roundEvent);
  const roundNumber = typeof roundEvent.payload.roundNumber === "number"
    ? roundEvent.payload.roundNumber
    : state.round.number - 1;
  const scoreText = scores ? `Player ${scores.player} / Opponent ${scores.opponent}` : "Scores resolved.";

  renderResultPanel(root, {
    actions: [
      {
        label: "Continue",
        onClick: () => options.onDismissRound(roundEvent.sequence),
      },
      {
        label: "Return to Menu",
        onClick: () => options.onExitToMenu?.(),
      },
    ],
    meta: scoreText,
    title: `Round ${roundNumber}: ${formatWinner(winnerIds)}`,
  });
}

function renderResultPanel(
  root: HTMLElement,
  options: {
    actions: { label: string; onClick: () => void }[];
    meta: string;
    title: string;
  },
) {
  root.hidden = false;
  const panel = document.createElement("div");
  panel.className = "hud__modal-panel";
  const title = document.createElement("h2");
  title.textContent = options.title;
  const meta = document.createElement("p");
  meta.textContent = options.meta;
  const actions = document.createElement("div");
  actions.className = "hud__modal-actions";

  for (const action of options.actions) {
    const button = createButton(action.label);
    button.addEventListener("click", action.onClick);
    actions.appendChild(button);
  }

  panel.append(title, meta, actions);
  root.replaceChildren(panel);
}

function updateInspection(
  root: HTMLElement,
  title: HTMLElement,
  meta: HTMLElement,
  abilities: HTMLElement,
  interaction: CardInteractionHudState,
) {
  const inspection = interaction.inspection;
  root.hidden = !inspection;

  if (!inspection) {
    return;
  }

  title.textContent = inspection.name;
  meta.textContent = [
    inspection.type.toUpperCase(),
    `Power ${inspection.basePower}`,
    inspection.rows.length > 0 ? `Rows ${inspection.rows.map(formatRow).join("/")}` : "No row target",
    `Zone ${inspection.zone}`,
  ].join(" | ");
  abilities.textContent = inspection.abilities.length > 0
    ? `Abilities: ${inspection.abilities.map(formatAbility).join(", ")}`
    : "Abilities: none";
}

function getHintText(inputBlocked: boolean, interaction: CardInteractionHudState, state: MatchState): string {
  if (interaction.feedback) {
    return interaction.feedback;
  }

  if (inputBlocked) {
    return "Animation queue blocking input.";
  }

  if (state.phase === "redraw") {
    return "Replace up to two cards, then finish both redraws to start the round.";
  }

  if (state.phase === "match-complete") {
    return "Match complete.";
  }

  if (interaction.selectedCardId && interaction.validRows.length > 0) {
    return "Choose a highlighted row or drag the selected card onto it.";
  }

  if (interaction.inspection) {
    return "Card inspected. Click again for instant specials or choose a valid row.";
  }

  return "Hover, click, or drag cards to interact.";
}

function createChip(label: string): { root: HTMLElement; value: HTMLElement } {
  const root = document.createElement("div");
  root.className = "hud__chip";
  const labelElement = document.createElement("span");
  labelElement.className = "hud__chip-label";
  labelElement.textContent = label;
  const value = document.createElement("span");
  value.className = "hud__chip-value";
  root.append(labelElement, value);
  return { root, value };
}

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "hud__button";
  button.type = "button";
  button.textContent = label;
  return button;
}

function createBadge(label: string): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "hud__badge";
  badge.textContent = label;
  return badge;
}

function createDebugLine(label: string, value: string): HTMLElement {
  const line = document.createElement("div");
  line.className = "hud__debug-line";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.textContent = value;
  line.append(labelElement, valueElement);
  return line;
}

function getSuggestedAction(state: MatchState): GameAction | undefined {
  if (state.phase === "redraw") {
    const playerId = getNextRedrawPlayer(state);
    return playerId ? chooseAiAction(state, playerId)?.action : undefined;
  }

  if (state.phase !== "playing") {
    return undefined;
  }

  return chooseAiAction(state, state.round.activePlayerId)?.action;
}

function getNextRedrawPlayer(state: MatchState): PlayerId | undefined {
  if (state.phase !== "redraw") {
    return undefined;
  }

  if (!state.players.player.hand.redrawComplete) {
    return "player";
  }

  if (!state.players.opponent.hand.redrawComplete) {
    return "opponent";
  }

  return undefined;
}

function getLeaderAction(state: MatchState): GameAction | undefined {
  if (state.phase !== "playing") {
    return undefined;
  }

  const playerId = state.round.activePlayerId;
  const player = state.players[playerId];

  if (player.leaderUsed || !player.leaderCardId) {
    return undefined;
  }

  const immediate = createImmediateAction(state, player.leaderCardId);

  if (immediate) {
    return immediate;
  }

  const definition = getCardDefinition(state, player.leaderCardId);

  if (definition.abilities.includes("weather")) {
    const rowId = definition.rows[0] ?? ROWS.find((candidate) => !state.board.weather[candidate]) ?? "close";
    return {
      type: "use-leader",
      playerId,
      rowId,
    };
  }

  return undefined;
}

function getLeaderButtonLabel(state: MatchState): string {
  const player = state.players[state.round.activePlayerId];

  if (player.leaderUsed) {
    return "Leader Used";
  }

  if (!player.leaderCardId) {
    return "Leader";
  }

  return `Leader: ${formatLeaderShortName(getCardDefinition(state, player.leaderCardId).name)}`;
}

function getCardDefinition(state: MatchState, cardInstanceId: CardInstanceId): CardDefinition {
  const card = state.cards[cardInstanceId];
  return state.cardDefinitions[card.definitionId];
}

function getLatestEvent(state: MatchState, type: GameEvent["type"]): GameEvent | undefined {
  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    if (state.eventLog[index].type === type) {
      return state.eventLog[index];
    }
  }

  return undefined;
}

function getRoundScores(event: GameEvent): Record<PlayerId, number> | undefined {
  const scores = event.payload.scores;

  if (
    isRecord(scores) &&
    typeof scores.player === "number" &&
    typeof scores.opponent === "number"
  ) {
    return {
      opponent: scores.opponent,
      player: scores.player,
    };
  }

  return undefined;
}

function getWinnerIds(event: GameEvent): PlayerId[] {
  const winnerIds = event.payload.winnerIds;

  if (!Array.isArray(winnerIds)) {
    return [];
  }

  return winnerIds.filter(isPlayerId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "player" || value === "opponent";
}

function getPlayerId(value: string): PlayerId | undefined {
  return isPlayerId(value) ? value : undefined;
}

function getFactionId(value: string): FactionId | undefined {
  return FACTIONS.some((faction) => faction.id === value) ? value as FactionId : undefined;
}

function getRowId(value: string): RowId | undefined {
  return value === "close" || value === "ranged" || value === "siege" ? value : undefined;
}

function getAbilityId(value: string): AbilityId | undefined {
  return ABILITIES.includes(value as AbilityId) ? value as AbilityId : undefined;
}

function formatScoreBreakdown(state: MatchState): string {
  const breakdown = calculateScoreBreakdown(state);

  return (["opponent", "player"] as const).map((playerId) => {
    const player = breakdown[playerId];
    const rows = ROWS.map((rowId) => {
      const row = player.rows[rowId];
      const modifiers = [
        row.weatherActive ? "weather" : undefined,
        row.hornActive ? "horn" : undefined,
      ].filter(Boolean).join(", ");
      return `${formatRow(rowId)}: ${row.total} (${row.cards.length} cards${modifiers ? `, ${modifiers}` : ""})`;
    }).join("\n  ");

    return `${formatPlayer(playerId)} total ${player.total}\n  ${rows}`;
  }).join("\n\n");
}

function formatWinner(winnerIds: PlayerId[]): string {
  if (winnerIds.length === 0) {
    return "Draw";
  }

  if (winnerIds.length > 1) {
    return "Shared round";
  }

  return formatPlayer(winnerIds[0]);
}

function formatPhase(phase: MatchState["phase"]): string {
  return phase
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlayer(playerId: PlayerId): string {
  return playerId === "player" ? "Player" : "Opponent";
}

function formatFaction(factionId: FactionId): string {
  return FACTIONS.find((faction) => faction.id === factionId)?.name ?? factionId;
}

function formatRow(rowId: RowId): string {
  return rowId[0].toUpperCase() + rowId.slice(1);
}

function formatAbilities(abilities: AbilityId[]): string {
  return abilities.length > 0 ? abilities.map(formatAbility).join(", ") : "No ability";
}

function formatAbility(ability: string): string {
  return ability
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLeaderShortName(name: string): string {
  return name.split(":")[0].trim().split(" ")[0] ?? name;
}
