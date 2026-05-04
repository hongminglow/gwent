import { assetManifest } from "../../assets/manifest";
import { ALL_CARD_DEFINITIONS } from "../../data/cards";
import { FACTIONS } from "../../data/factions";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "../../audio/audioEngine";
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
import { createRulesOverlay } from "../rules/createRulesOverlay";

export type Hud = {
  dispose: () => void;
  setInteraction: (interaction: CardInteractionHudState) => void;
  update: (state: MatchState, inputBlocked: boolean, interaction?: CardInteractionHudState) => void;
};

export type HudOptions = {
  audioSettings?: AudioSettings;
  onAudioMutedChange?: (muted: boolean) => void;
  onAudioVolumeChange?: (volume: number) => void;
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

const ABILITY_COPY: Record<AbilityId, string> = {
  agile: "May be played into either Close Combat or Ranged Combat.",
  "clear-weather": "Removes every active weather effect from the battlefield.",
  "commanders-horn": "Doubles eligible unit strength in the chosen row.",
  decoy: "Returns one eligible non-hero unit from your battlefield to hand.",
  hero: "Ignores weather, Horn, Morale Boost, Tight Bond, Decoy, Medic, and Scorch targeting rules.",
  medic: "Revives one eligible normal unit from your discard pile when played.",
  "morale-boost": "Adds +1 strength to other eligible normal units in the same row.",
  muster: "Pulls matching group cards from your deck or hand onto the battlefield.",
  scorch: "Destroys every strongest non-hero unit on the battlefield if its final strength is above 0.",
  spy: "Plays onto the opponent's board, then draws two cards for you.",
  "tight-bond": "Multiplies matching units by the number of same-bond copies in that row.",
  weather: "Applies a row weather effect that reduces eligible units in that row to strength 1.",
};

type CardDetail = {
  abilities: AbilityId[];
  artKey?: string;
  basePower: number;
  name: string;
  rows: RowId[];
  type: CardDefinition["type"];
  zone?: string;
};

type RoundSummary = {
  cardsPlayed: Record<PlayerId, number>;
  roundNumber: number;
  scores: Record<PlayerId, number>;
  winnerIds: PlayerId[];
};

type BattleLogEntry = {
  meta: string;
  text: string;
  tone: "danger" | "effect" | "info" | "play" | "round";
};

export function createHud(root: HTMLElement, state: MatchState, options: HudOptions): Hud {
  let audioSettings: AudioSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    ...options.audioSettings,
  };
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
  const rulesButton = createButton("Rules");
  rulesButton.setAttribute("aria-expanded", "false");
  rulesButton.setAttribute("aria-haspopup", "dialog");
  const logButton = createButton("Log");
  logButton.setAttribute("aria-expanded", "false");
  const settingsButton = createButton("Settings");
  const debugButton = createButton("Debug");
  const menuButton = createButton("Menu");
  controls.append(
    finishRedrawButton,
    suggestedButton,
    leaderButton,
    passButton,
    aiStepButton,
    rulesButton,
    logButton,
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
  const inspectAbilities = document.createElement("div");
  inspectAbilities.className = "hud__inspect-abilities";
  inspect.append(inspectTitle, inspectMeta, inspectAbilities);

  const cardTooltip = document.createElement("aside");
  cardTooltip.className = "hud__card-tooltip";
  cardTooltip.setAttribute("aria-label", "Hovered card ability details");
  cardTooltip.hidden = true;
  const cardTooltipTitle = document.createElement("h2");
  cardTooltipTitle.className = "hud__card-tooltip-title";
  const cardTooltipMeta = document.createElement("p");
  cardTooltipMeta.className = "hud__card-tooltip-meta";
  const cardTooltipAbilities = document.createElement("div");
  cardTooltipAbilities.className = "hud__card-tooltip-abilities";
  cardTooltip.append(cardTooltipTitle, cardTooltipMeta, cardTooltipAbilities);

  const modal = document.createElement("section");
  modal.className = "hud__modal";
  modal.setAttribute("aria-label", "Match result");
  modal.hidden = true;
  const rulesOverlay = createRulesOverlay({
    onOpenChange: (open) => {
      rulesButton.setAttribute("aria-expanded", String(open));
    },
  });

  const settingsDrawer = createSettingsDrawer({
    audioSettings,
    onAudioMutedChange: (muted) => {
      audioSettings = {
        ...audioSettings,
        muted,
      };
      options.onAudioMutedChange?.(muted);
      renderSettingsDrawer();
    },
    onAudioVolumeChange: (volume) => {
      audioSettings = {
        ...audioSettings,
        masterVolume: volume,
      };
      options.onAudioVolumeChange?.(volume);
      renderSettingsDrawer();
    },
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
  const battleLogDrawer = createBattleLogDrawer();

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
    cardTooltip,
    hint,
    modal,
    rulesOverlay.root,
    battleLogDrawer.root,
    settingsDrawer.root,
    debugToolsDrawer.root,
    debugOverlay,
  );
  shell.appendChild(hud);
  root.appendChild(shell);

  let latestState = state;
  let latestInputBlocked = false;
  let latestInteraction: CardInteractionHudState = {
    blockedCardTargets: [],
    validCardTargets: [],
    validRows: [],
  };
  let dismissedRoundSequence = -1;
  let logOpen = false;
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
    const action = getAiStepAction(latestState);

    if (action && !latestInputBlocked) {
      options.onIntent(action);
    }
  });

  rulesButton.addEventListener("click", () => {
    logOpen = false;
    settingsOpen = false;
    debugToolsOpen = false;
    renderBattleLogDrawer();
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    rulesOverlay.toggle();
    rulesButton.setAttribute("aria-expanded", String(rulesOverlay.isOpen()));
  });

  logButton.addEventListener("click", () => {
    logOpen = !logOpen;
    if (logOpen) {
      settingsOpen = false;
      debugToolsOpen = false;
      rulesOverlay.hide();
    }
    renderBattleLogDrawer();
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    rulesButton.setAttribute("aria-expanded", "false");
  });

  settingsButton.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    if (settingsOpen) {
      logOpen = false;
      debugToolsOpen = false;
      rulesOverlay.hide();
    }
    renderBattleLogDrawer();
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    rulesButton.setAttribute("aria-expanded", "false");
  });

  debugButton.addEventListener("click", () => {
    debugToolsOpen = !debugToolsOpen;
    if (debugToolsOpen) {
      logOpen = false;
      settingsOpen = false;
      rulesOverlay.hide();
    }
    renderBattleLogDrawer();
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    rulesButton.setAttribute("aria-expanded", "false");
  });

  menuButton.addEventListener("click", () => {
    options.onExitToMenu?.();
  });

  const renderBattleLogDrawer = () => {
    battleLogDrawer.root.hidden = !logOpen;
    logButton.setAttribute("aria-expanded", String(logOpen));
    battleLogDrawer.update(latestState);
  };

  const renderSettingsDrawer = () => {
    settingsDrawer.root.hidden = !settingsOpen;
    settingsButton.setAttribute("aria-expanded", String(settingsOpen));
    settingsDrawer.fastAnimationsInput.checked = debugFlags.fastAnimations;
    settingsDrawer.debugCameraInput.checked = debugFlags.debugCamera;
    settingsDrawer.showDebugInput.checked = debugFlags.showPerf;
    settingsDrawer.muteAudioInput.checked = audioSettings.muted;
    settingsDrawer.volumeInput.value = `${Math.round(audioSettings.masterVolume * 100)}`;
    settingsDrawer.volumeValue.textContent = `${Math.round(audioSettings.masterVolume * 100)}%`;
  };

  const renderDebugToolsDrawer = () => {
    debugToolsDrawer.root.hidden = !debugToolsOpen;
    debugButton.setAttribute("aria-expanded", String(debugToolsOpen));
    debugToolsDrawer.update(latestState, {
      aiAutoplayEnabled: debugAiAutoplayEnabled,
      placementZonesVisible: debugFlags.showPlacementZones,
    });
  };

  const closeDrawersOnOutsidePointer = (event: PointerEvent) => {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    let changed = false;

    if (logOpen && !battleLogDrawer.root.contains(target) && !logButton.contains(target)) {
      logOpen = false;
      changed = true;
    }

    if (settingsOpen && !settingsDrawer.root.contains(target) && !settingsButton.contains(target)) {
      settingsOpen = false;
      changed = true;
    }

    if (debugToolsOpen && !debugToolsDrawer.root.contains(target) && !debugButton.contains(target)) {
      debugToolsOpen = false;
      changed = true;
    }

    if (changed) {
      renderBattleLogDrawer();
      renderSettingsDrawer();
      renderDebugToolsDrawer();

      if (!controls.contains(target)) {
        event.stopPropagation();
      }
    }
  };

  window.addEventListener("pointerdown", closeDrawersOnOutsidePointer, true);

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
    const aiStepAction = getAiStepAction(nextState);
    const leaderAction = getLeaderAction(nextState);
    const redrawPlayer = getNextRedrawPlayer(nextState);

    phase.textContent = `Testing build. ${formatPhase(nextState.phase)}.`;
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
    updateCardTooltip(
      cardTooltip,
      cardTooltipTitle,
      cardTooltipMeta,
      cardTooltipAbilities,
      latestInteraction,
      inputBlocked,
    );
    const hintText = getHintText(inputBlocked, latestInteraction, nextState);
    hint.hidden = hintText.length === 0;
    hint.textContent = hintText;

    finishRedrawButton.textContent = redrawPlayer ? `Finish ${formatPlayer(redrawPlayer)} Redraw` : "Finish Redraw";
    finishRedrawButton.disabled = inputBlocked || nextState.phase !== "redraw" || !redrawPlayer;
    suggestedButton.disabled = inputBlocked || !suggestedAction;
    leaderButton.disabled = inputBlocked || !leaderAction;
    leaderButton.textContent = getLeaderButtonLabel(nextState);
    passButton.disabled = inputBlocked || nextState.phase !== "playing" || nextState.players[activePlayer].hasPassed;
    aiStepButton.disabled = inputBlocked || !aiStepAction;
    aiStepButton.textContent = getAiStepButtonLabel(nextState);
    aiStepButton.title = getAiStepButtonTitle(nextState, aiStepAction);
    menuButton.disabled = inputBlocked && nextState.phase !== "match-complete";
    settingsButton.setAttribute("aria-expanded", String(settingsOpen));
    debugButton.setAttribute("aria-expanded", String(debugToolsOpen));
    renderBattleLogDrawer();
    renderSettingsDrawer();
    renderDebugToolsDrawer();
    renderDebugOverlay(nextState, inputBlocked, latestInteraction);
  };

  update(state, false);

  return {
    dispose() {
      window.removeEventListener("pointerdown", closeDrawersOnOutsidePointer, true);
      rulesOverlay.dispose();
      shell.remove();
    },
    setInteraction(interaction) {
      update(latestState, latestInputBlocked, interaction);
    },
    update,
  };
}

function createSettingsDrawer(options: {
  audioSettings: AudioSettings;
  onAudioMutedChange: (muted: boolean) => void;
  onAudioVolumeChange: (volume: number) => void;
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
  const muteAudio = createToggle("Mute audio", options.audioSettings.muted);
  const volume = createRange("Master volume", Math.round(options.audioSettings.masterVolume * 100));
  const fastAnimations = createToggle("Fast animations", debugFlags.fastAnimations);
  const debugCamera = createToggle("Debug camera", debugFlags.debugCamera);
  const showDebug = createToggle("Debug overlay", debugFlags.showPerf);

  muteAudio.input.addEventListener("change", () => {
    options.onAudioMutedChange(muteAudio.input.checked);
  });
  volume.input.addEventListener("input", () => {
    options.onAudioVolumeChange(Number(volume.input.value) / 100);
  });
  fastAnimations.input.addEventListener("change", () => {
    options.onFastAnimationsChange(fastAnimations.input.checked);
  });
  debugCamera.input.addEventListener("change", () => {
    options.onDebugCameraChange(debugCamera.input.checked);
  });
  showDebug.input.addEventListener("change", () => {
    options.onShowDebugChange(showDebug.input.checked);
  });

  root.append(title, muteAudio.root, volume.root, fastAnimations.root, debugCamera.root, showDebug.root);

  return {
    debugCameraInput: debugCamera.input,
    fastAnimationsInput: fastAnimations.input,
    muteAudioInput: muteAudio.input,
    root,
    showDebugInput: showDebug.input,
    volumeInput: volume.input,
    volumeValue: volume.value,
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

function createBattleLogDrawer() {
  const root = document.createElement("aside");
  root.className = "hud__battle-log";
  root.hidden = true;
  root.setAttribute("aria-label", "Battle log");

  const title = document.createElement("h2");
  title.className = "hud__drawer-title";
  title.textContent = "Battle Log";
  const list = document.createElement("ol");
  list.className = "hud__battle-log-list";
  root.append(title, list);

  return {
    root,
    update(state: MatchState) {
      const entries = createBattleLogEntries(state);

      if (entries.length === 0) {
        const empty = document.createElement("li");
        empty.className = "hud__battle-log-empty";
        empty.textContent = "No actions recorded yet.";
        list.replaceChildren(empty);
        return;
      }

      list.replaceChildren(...entries.map(createBattleLogItem));
    },
  };
}

function createBattleLogItem(entry: BattleLogEntry): HTMLElement {
  const item = document.createElement("li");
  item.className = `hud__battle-log-item hud__battle-log-item--${entry.tone}`;
  const meta = document.createElement("span");
  meta.textContent = entry.meta;
  const text = document.createElement("strong");
  text.textContent = entry.text;
  item.append(meta, text);
  return item;
}

function createBattleLogEntries(state: MatchState): BattleLogEntry[] {
  return state.eventLog
    .map((event) => formatBattleLogEvent(state, event))
    .filter((entry): entry is BattleLogEntry => Boolean(entry))
    .slice(-80)
    .reverse();
}

function formatBattleLogEvent(state: MatchState, event: GameEvent): BattleLogEntry | undefined {
  const meta = `#${event.sequence}`;

  switch (event.type) {
    case "match.created":
      return undefined;
    case "phase.changed":
      return undefined;
    case "turn.changed":
      return undefined;
    case "player.passed": {
      const playerId = getPlayerIdFromUnknown(event.payload.playerId);
      return playerId
        ? {
            meta,
            text: `${formatPlayer(playerId)} passed.`,
            tone: "play",
          }
        : undefined;
    }
    case "card.drawn": {
      const playerId = getPlayerIdFromUnknown(event.payload.playerId);
      const reason = typeof event.payload.reason === "string" ? event.payload.reason : undefined;
      const cardName = playerId === "player" ? getEventCardName(state, event) : undefined;

      if (!playerId || isOpeningDrawReason(reason)) {
        return undefined;
      }

      return {
        meta,
        text: cardName
          ? `${formatPlayer(playerId)} drew ${cardName}${reason ? ` (${formatLogReason(reason)})` : ""}.`
          : `${formatPlayer(playerId)} drew a card${reason ? ` (${formatLogReason(reason)})` : ""}.`,
        tone: "info",
      };
    }
    case "card.played":
      return formatCardPlayedLog(state, event, meta);
    case "card.destroyed": {
      const cardName = getEventCardName(state, event);
      return cardName
        ? {
            meta,
            text: `${cardName} was discarded${formatOptionalReason(event)}.`,
            tone: "danger",
          }
        : undefined;
    }
    case "card.revived": {
      const playerId = getPlayerIdFromUnknown(event.payload.playerId);
      const cardName = getEventCardName(state, event);
      return playerId && cardName
        ? {
            meta,
            text: `${formatPlayer(playerId)} revived ${cardName}.`,
            tone: "effect",
          }
        : undefined;
    }
    case "leader.used": {
      const playerId = getPlayerIdFromUnknown(event.payload.playerId);
      const leaderCardInstanceId = getPayloadString(event, "leaderCardInstanceId");
      const leaderName = leaderCardInstanceId ? getCardName(state, leaderCardInstanceId) : undefined;
      return playerId
        ? {
            meta,
            text: `${formatPlayer(playerId)} used ${leaderName ?? "their leader"}.`,
            tone: "effect",
          }
        : undefined;
    }
    case "weather.applied": {
      const rowId = getRowIdFromUnknown(event.payload.rowId);
      const sourceName = getSourceCardName(state, event);
      return rowId
        ? {
            meta,
            text: `${sourceName ?? "Weather"} applied to ${formatRow(rowId)}.`,
            tone: "effect",
          }
        : undefined;
    }
    case "weather.cleared":
      return {
        meta,
        text: "Weather cleared from the battlefield.",
        tone: "effect",
      };
    case "row.buff.applied": {
      const playerId = getPlayerIdFromUnknown(event.payload.playerId);
      const rowId = getRowIdFromUnknown(event.payload.rowId);
      return playerId && rowId
        ? {
            meta,
            text: `${formatPlayer(playerId)} ${formatRow(rowId)} gained ${formatLogReason(getPayloadString(event, "buff") ?? "buff")}.`,
            tone: "effect",
          }
        : undefined;
    }
    case "round.ended": {
      const roundNumber = typeof event.payload.roundNumber === "number" ? event.payload.roundNumber : undefined;
      const scores = getRoundScores(event);
      const scoreText = scores ? ` ${scores.player}-${scores.opponent}` : "";
      return {
        meta,
        text: `Round ${roundNumber ?? "?"} ended: ${formatWinner(getWinnerIds(event))}.${scoreText}`,
        tone: "round",
      };
    }
    case "match.ended": {
      const winnerId = getPlayerIdFromUnknown(event.payload.winnerId);
      return {
        meta,
        text: winnerId === "player" ? "Player won the match." : winnerId === "opponent" ? "Opponent won the match." : "Match ended.",
        tone: "round",
      };
    }
    default:
      return assertNever(event.type);
  }
}

function formatCardPlayedLog(
  state: MatchState,
  event: GameEvent,
  meta: string,
): BattleLogEntry | undefined {
  const playerId = getPlayerIdFromUnknown(event.payload.playerId);
  const cardName = getEventCardName(state, event);

  if (!playerId || !cardName) {
    return undefined;
  }

  const rowId = getRowIdFromUnknown(event.payload.rowId);
  const targetCardInstanceId = getPayloadString(event, "targetCardInstanceId");
  const reason = typeof event.payload.reason === "string" ? event.payload.reason : undefined;
  const controllerId = getPlayerIdFromUnknown(event.payload.controllerId);
  const rowText = rowId ? ` to ${controllerId && controllerId !== playerId ? `${formatPlayer(controllerId)} ` : ""}${formatRow(rowId)}` : "";

  if (reason === "decoy") {
    const targetName = targetCardInstanceId ? getCardName(state, targetCardInstanceId) : undefined;
    return {
      meta,
      text: `${formatPlayer(playerId)} used Decoy${targetName ? ` to recover ${targetName}` : ""}.`,
      tone: "effect",
    };
  }

  if (reason === "medic") {
    return {
      meta,
      text: `${formatPlayer(playerId)} returned ${cardName} from discard${rowText}.`,
      tone: "effect",
    };
  }

  if (reason === "muster") {
    return {
      meta,
      text: `${cardName} mustered${rowText}.`,
      tone: "effect",
    };
  }

  if (reason === "spy") {
    return {
      meta,
      text: `${formatPlayer(playerId)} played ${cardName}${rowText} and drew cards.`,
      tone: "play",
    };
  }

  return {
    meta,
    text: `${formatPlayer(playerId)} played ${cardName}${rowText}.`,
    tone: event.payload.special === true ? "effect" : "play",
  };
}

function getEventCardName(state: MatchState, event: GameEvent): string | undefined {
  const cardInstanceId = getPayloadString(event, "cardInstanceId");
  return cardInstanceId ? getCardName(state, cardInstanceId) : undefined;
}

function getCardName(state: MatchState, cardInstanceId: CardInstanceId): string | undefined {
  const card = state.cards[cardInstanceId];
  return card ? state.cardDefinitions[card.definitionId]?.name : undefined;
}

function getSourceCardName(state: MatchState, event: GameEvent): string | undefined {
  const sourceCardId = getPayloadString(event, "sourceCardId");

  if (!sourceCardId) {
    return undefined;
  }

  return state.cardDefinitions[sourceCardId]?.name ?? sourceCardId;
}

function formatOptionalReason(event: GameEvent): string {
  const reason = typeof event.payload.reason === "string" ? event.payload.reason : undefined;
  return reason ? ` by ${formatLogReason(reason)}` : "";
}

function formatLogReason(reason: string): string {
  return reason
    .replace(/^faction:/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function isOpeningDrawReason(reason?: string): boolean {
  return reason === "opening-hand" || reason === "redraw";
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
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

function createRange(
  label: string,
  value: number,
): { input: HTMLInputElement; root: HTMLLabelElement; value: HTMLElement } {
  const root = document.createElement("label");
  root.className = "hud__range";
  const header = document.createElement("span");
  const text = document.createElement("span");
  text.textContent = label;
  const valueLabel = document.createElement("strong");
  valueLabel.textContent = `${value}%`;
  header.append(text, valueLabel);
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.value = `${value}`;
  root.append(header, input);

  return {
    input,
    root,
    value: valueLabel,
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
  const previousCards = root.querySelector<HTMLElement>(".hud__redraw-cards");
  const previousScrollTop = previousCards?.scrollTop ?? 0;
  const previousScrollLeft = previousCards?.scrollLeft ?? 0;
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
  const redrawDetail = document.createElement("aside");
  redrawDetail.className = "hud__redraw-detail";
  const redrawBody = document.createElement("div");
  redrawBody.className = "hud__redraw-body";
  let firstDefinition: CardDefinition | undefined;

  for (const cardInstanceId of player.hand.cards) {
    const card = state.cards[cardInstanceId];
    const definition = state.cardDefinitions[card.definitionId];
    firstDefinition ??= definition;
    const button = document.createElement("button");
    button.className = "hud__redraw-card";
    button.type = "button";
    button.disabled = inputBlocked;
    button.setAttribute("aria-disabled", String(inputBlocked || !isPlayerRedrawOpen));
    button.setAttribute("aria-label", getCardDetailPlainText(definition));
    const artUrl = getCardArtUrl(definition);
    const content = document.createElement("span");
    content.className = "hud__redraw-card-copy";
    const name = document.createElement("span");
    name.className = "hud__redraw-card-name";
    name.textContent = definition.name;
    const power = document.createElement("strong");
    power.textContent = definition.type === "special" ? "Special" : `${definition.basePower}`;
    const abilities = document.createElement("small");
    abilities.textContent = formatAbilities(definition.abilities);
    content.append(name, power, abilities);

    if (artUrl) {
      const art = document.createElement("img");
      art.className = "hud__redraw-card-art";
      art.src = artUrl;
      art.alt = "";
      art.decoding = "async";
      button.classList.add("hud__redraw-card--with-art");
      button.append(art, content);
    } else {
      button.append(content);
    }

    button.addEventListener("pointerenter", () => {
      renderCardDetail(redrawDetail, definition, {
        eyebrow: "Selected redraw card",
      });
    });
    button.addEventListener("focus", () => {
      renderCardDetail(redrawDetail, definition, {
        eyebrow: "Selected redraw card",
      });
    });
    button.addEventListener("click", () => {
      if (!button.disabled && isPlayerRedrawOpen) {
        onIntent({
          type: "redraw-card",
          playerId: "player",
          cardInstanceId,
        });
      }
    });
    cards.appendChild(button);
  }

  if (firstDefinition) {
    renderCardDetail(redrawDetail, firstDefinition, {
      eyebrow: "Card ability reference",
    });
  } else {
    redrawDetail.textContent = "No cards available for redraw.";
  }

  redrawBody.append(cards, redrawDetail);
  root.replaceChildren(header, meta, redrawBody);
  cards.scrollTop = previousScrollTop;
  cards.scrollLeft = previousScrollLeft;
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
      content: createMatchSummaryContent(state),
      title: formatMatchResultTitle(winnerId),
      variant: winnerId === "player" ? "victory" : "defeat",
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
    content?: HTMLElement[];
    eyebrow?: string;
    meta?: string;
    title: string;
    variant?: "defeat" | "victory";
  },
) {
  root.hidden = false;
  const panel = document.createElement("div");
  panel.className = "hud__modal-panel";
  if (options.variant) {
    panel.classList.add(`hud__modal-panel--${options.variant}`);
  }
  const eyebrow = document.createElement("span");
  eyebrow.className = "hud__modal-eyebrow";
  eyebrow.textContent = options.eyebrow ?? "";
  const title = document.createElement("h2");
  title.textContent = options.title;
  const actions = document.createElement("div");
  actions.className = "hud__modal-actions";

  for (const action of options.actions) {
    const button = createButton(action.label);
    button.addEventListener("click", action.onClick);
    actions.appendChild(button);
  }

  if (options.eyebrow) {
    panel.appendChild(eyebrow);
  }

  panel.appendChild(title);

  if (options.meta) {
    const meta = document.createElement("p");
    meta.textContent = options.meta;
    panel.appendChild(meta);
  }

  panel.append(...(options.content ?? []), actions);
  root.replaceChildren(panel);
}

function createMatchSummaryContent(state: MatchState): HTMLElement[] {
  const summaries = getRoundSummaries(state);
  const cardsPlayed = summaries.reduce<Record<PlayerId, number>>((total, summary) => ({
    opponent: total.opponent + summary.cardsPlayed.opponent,
    player: total.player + summary.cardsPlayed.player,
  }), {
    opponent: 0,
    player: 0,
  });
  const destroyedCards = state.eventLog.filter((event) => event.type === "card.destroyed").length;
  const revivedCards = state.eventLog.filter((event) => event.type === "card.revived").length;
  const playerHighRound = Math.max(0, ...summaries.map((summary) => summary.scores.player));
  const opponentHighRound = Math.max(0, ...summaries.map((summary) => summary.scores.opponent));
  const metrics = document.createElement("div");
  metrics.className = "hud__summary-metrics";
  metrics.append(
    createSummaryMetric("Final Score", `${state.players.player.roundWins}-${state.players.opponent.roundWins}`, "Rounds won"),
    createSummaryMetric("Cards Placed", `${cardsPlayed.player}-${cardsPlayed.opponent}`, "Player / Opponent"),
    createSummaryMetric("Best Round", `${playerHighRound}-${opponentHighRound}`, "Highest score"),
    createSummaryMetric("Casualties", `${destroyedCards}`, `${revivedCards} revived`),
  );

  const rounds = document.createElement("div");
  rounds.className = "hud__summary-rounds";
  for (const summary of summaries) {
    rounds.appendChild(createRoundSummaryRow(summary));
  }

  return [metrics, rounds];
}

function createSummaryMetric(label: string, value: string, detail: string): HTMLElement {
  const metric = document.createElement("div");
  metric.className = "hud__summary-metric";
  metric.innerHTML = `
    <span>${label}</span>
    <strong>${value}</strong>
    <small>${detail}</small>
  `;
  return metric;
}

function createRoundSummaryRow(summary: RoundSummary): HTMLElement {
  const row = document.createElement("div");
  row.className = "hud__summary-round";
  row.innerHTML = `
    <span>Round ${summary.roundNumber}</span>
    <strong>${summary.scores.player}-${summary.scores.opponent}</strong>
    <small>${formatWinner(summary.winnerIds)} | cards ${summary.cardsPlayed.player}-${summary.cardsPlayed.opponent}</small>
  `;
  return row;
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
  meta.textContent = formatCardMeta(inspection);
  renderAbilityDetails(abilities, inspection.abilities);
}

function updateCardTooltip(
  root: HTMLElement,
  title: HTMLElement,
  meta: HTMLElement,
  abilities: HTMLElement,
  interaction: CardInteractionHudState,
  inputBlocked: boolean,
) {
  const inspection = interaction.inspection;
  const pointer = interaction.pointer;
  const shouldShow = Boolean(inspection && pointer && !inputBlocked);
  root.hidden = !shouldShow;

  if (!shouldShow || !inspection || !pointer) {
    return;
  }

  title.textContent = inspection.name;
  meta.textContent = formatCardMeta(inspection);
  renderAbilityDetails(abilities, inspection.abilities);

  const padding = 14;
  const gap = 18;
  const width = root.offsetWidth || 320;
  const height = root.offsetHeight || 180;
  const right = pointer.x + gap + width;
  const below = pointer.y + gap + height;
  const x = right > window.innerWidth - padding
    ? Math.max(padding, pointer.x - width - gap)
    : pointer.x + gap;
  const y = below > window.innerHeight - padding
    ? Math.max(padding, pointer.y - height - gap)
    : pointer.y + gap;
  root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function renderCardDetail(
  root: HTMLElement,
  detail: CardDetail,
  options: { eyebrow: string },
) {
  const eyebrow = document.createElement("span");
  eyebrow.className = "hud__redraw-detail-eyebrow";
  eyebrow.textContent = options.eyebrow;
  const title = document.createElement("h3");
  title.textContent = detail.name;
  const meta = document.createElement("p");
  meta.className = "hud__redraw-detail-meta";
  meta.textContent = formatCardMeta(detail);
  const artUrl = getCardArtUrl(detail);
  const art = artUrl ? document.createElement("img") : undefined;

  if (art && artUrl) {
    art.className = "hud__redraw-detail-art";
    art.src = artUrl;
    art.alt = "";
    art.decoding = "async";
  }

  const abilities = document.createElement("div");
  abilities.className = "hud__redraw-detail-abilities";
  renderAbilityDetails(abilities, detail.abilities);
  root.replaceChildren(...[eyebrow, art, title, meta, abilities].filter((element): element is HTMLElement => Boolean(element)));
}

function getCardArtUrl(detail: Pick<CardDetail, "artKey">): string | undefined {
  return detail.artKey ? assetManifest.cards[detail.artKey] : undefined;
}

function renderAbilityDetails(root: HTMLElement, abilities: AbilityId[]) {
  root.replaceChildren();

  if (abilities.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hud__ability-empty";
    empty.textContent = "No special ability. This card contributes raw row strength.";
    root.appendChild(empty);
    return;
  }

  for (const ability of abilities) {
    const item = document.createElement("div");
    item.className = "hud__ability-line";
    const name = document.createElement("strong");
    name.textContent = formatAbility(ability);
    const description = document.createElement("span");
    description.textContent = ABILITY_COPY[ability];
    item.append(name, description);
    root.appendChild(item);
  }
}

function formatCardMeta(detail: CardDetail): string {
  return [
    detail.type.toUpperCase(),
    formatPowerMeta(detail),
    detail.rows.length > 0 ? `Rows ${detail.rows.map(formatRow).join("/")}` : "No row target",
    detail.zone ? `Zone ${detail.zone}` : undefined,
  ].filter(Boolean).join(" | ");
}

function formatPowerMeta(detail: CardDetail): string {
  if (detail.type === "special" || detail.type === "leader") {
    return "No base power";
  }

  return `Power ${detail.basePower}`;
}

function getCardDetailPlainText(detail: CardDetail): string {
  const abilityText = detail.abilities.length > 0
    ? detail.abilities.map((ability) => `${formatAbility(ability)}: ${ABILITY_COPY[ability]}`).join("; ")
    : "No special ability.";

  return `${detail.name}. ${formatCardMeta(detail)}. ${abilityText}`;
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
    return `Playable targets are highlighted: ${formatTargets(interaction.validRows)}.`;
  }

  if (interaction.selectedCardId && interaction.validCardTargets.length > 0) {
    return `${interaction.validCardTargets.length} eligible battlefield card${interaction.validCardTargets.length === 1 ? "" : "s"} highlighted for targeting.`;
  }

  if (interaction.selectedCardId && interaction.validRows.length === 0) {
    return getNoTargetHint(state, interaction);
  }

  return "";
}

function getNoTargetHint(state: MatchState, interaction: CardInteractionHudState): string {
  const selectedCardId = interaction.selectedCardId;
  const inspection = interaction.inspection;

  if (!selectedCardId || !inspection) {
    return "";
  }

  if (state.phase !== "playing") {
    return "Cards can be played after both redraws are finished.";
  }

  if (inspection.ownerId !== state.round.activePlayerId) {
    return `It is ${formatPlayer(state.round.activePlayerId)}'s turn. ${formatPlayer(inspection.ownerId)} cards can only be inspected.`;
  }

  if (inspection.zone === "leader") {
    return state.players[inspection.ownerId].leaderUsed
      ? "That leader ability has already been used this match."
      : "This leader resolves without a row target. Use the Leader button or click the leader again.";
  }

  if (inspection.zone !== "hand") {
    return "Cards already on the battlefield can only be inspected.";
  }

  if (inspection.abilities.includes("scorch") || inspection.abilities.includes("clear-weather")) {
    return `${inspection.name} resolves immediately. Click the selected card again to play it.`;
  }

  if (inspection.abilities.includes("decoy")) {
    return "Decoy needs one of your non-hero battlefield units as a target, not a row.";
  }

  if (inspection.type === "special") {
    return `${inspection.name} does not have a row target.`;
  }

  return "";
}

function formatTargets(targets: { playerId: PlayerId; rowId: RowId }[]): string {
  const labels = targets.map((target) => `${formatPlayer(target.playerId)} ${formatRow(target.rowId)}`);
  return [...new Set(labels)].join(", ");
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

function getAiStepAction(state: MatchState): GameAction | undefined {
  if (state.phase === "redraw") {
    return getNextRedrawPlayer(state) === "opponent"
      ? chooseAiAction(state, "opponent")?.action
      : undefined;
  }

  if (state.phase !== "playing" || state.round.activePlayerId !== "opponent") {
    return undefined;
  }

  return chooseAiAction(state, "opponent")?.action;
}

function getAiStepButtonLabel(state: MatchState): string {
  if (state.phase === "playing" && state.round.activePlayerId !== "opponent") {
    return "AI Waiting";
  }

  if (state.phase === "redraw" && getNextRedrawPlayer(state) !== "opponent") {
    return "AI Waiting";
  }

  return "AI Step";
}

function getAiStepButtonTitle(state: MatchState, action?: GameAction): string {
  if (action) {
    return "Resolve the opponent's next AI action.";
  }

  if (state.phase === "redraw") {
    return "AI Step is available after your redraw is finished and the opponent redraw is pending.";
  }

  if (state.phase === "playing" && state.round.activePlayerId !== "opponent") {
    return "AI Step is available only on the opponent's turn. Use Play Suggested for your own hint action.";
  }

  return "No opponent AI action is currently available.";
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

function formatMatchResultTitle(winnerId?: PlayerId): string {
  if (winnerId === "player") {
    return "You won the match";
  }

  if (winnerId === "opponent") {
    return "You lost the match";
  }

  return "Match complete";
}

function getRoundSummaries(state: MatchState): RoundSummary[] {
  const roundEvents = state.eventLog
    .filter((event) => event.type === "round.ended")
    .sort((a, b) => a.sequence - b.sequence);
  const summaries: RoundSummary[] = [];
  let previousRoundSequence = 0;

  for (const event of roundEvents) {
    const scores = getRoundScores(event) ?? {
      opponent: 0,
      player: 0,
    };
    const roundNumber = typeof event.payload.roundNumber === "number"
      ? event.payload.roundNumber
      : summaries.length + 1;
    const cardsPlayed = countCardPlaysBetween(state, previousRoundSequence, event.sequence);
    summaries.push({
      cardsPlayed,
      roundNumber,
      scores,
      winnerIds: getWinnerIds(event),
    });
    previousRoundSequence = event.sequence;
  }

  return summaries;
}

function countCardPlaysBetween(
  state: MatchState,
  startExclusive: number,
  endInclusive: number,
): Record<PlayerId, number> {
  return state.eventLog.reduce<Record<PlayerId, number>>((counts, event) => {
    if (event.sequence <= startExclusive || event.sequence > endInclusive || event.type !== "card.played") {
      return counts;
    }

    const playerId = getPlayerIdFromUnknown(event.payload.playerId);

    if (!playerId) {
      return counts;
    }

    return {
      ...counts,
      [playerId]: counts[playerId] + 1,
    };
  }, {
    opponent: 0,
    player: 0,
  });
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

function getPlayerIdFromUnknown(value: unknown): PlayerId | undefined {
  return isPlayerId(value) ? value : undefined;
}

function getFactionId(value: string): FactionId | undefined {
  return FACTIONS.some((faction) => faction.id === value) ? value as FactionId : undefined;
}

function getRowId(value: string): RowId | undefined {
  return value === "close" || value === "ranged" || value === "siege" ? value : undefined;
}

function getRowIdFromUnknown(value: unknown): RowId | undefined {
  return typeof value === "string" ? getRowId(value) : undefined;
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

function assertNever(value: never): never {
  throw new Error(`Unhandled HUD value: ${String(value)}`);
}
