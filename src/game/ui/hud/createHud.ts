import { chooseAiAction } from "../../simulation/aiOpponent";
import type { GameAction } from "../../simulation/actions";
import { calculateScores } from "../../simulation/scoring";
import type { MatchState, PlayerId } from "../../simulation/types";
import type { CardInteractionHudState } from "../../renderer/cardInteraction";

export type Hud = {
  setInteraction: (interaction: CardInteractionHudState) => void;
  update: (state: MatchState, inputBlocked: boolean, interaction?: CardInteractionHudState) => void;
  dispose: () => void;
};

export type HudOptions = {
  onIntent: (action: GameAction) => void;
};

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

  const strip = document.createElement("div");
  strip.className = "hud__strip";
  strip.setAttribute("aria-label", "Match state");

  const phaseChip = createChip("Phase");
  const turnChip = createChip("Turn");
  const playerScoreChip = createChip("Player");
  const opponentScoreChip = createChip("Opponent");
  const handChip = createChip("Hand");
  strip.append(phaseChip.root, turnChip.root, playerScoreChip.root, opponentScoreChip.root, handChip.root);

  const controls = document.createElement("div");
  controls.className = "hud__controls";
  const finishRedrawButton = createButton("Finish Redraw");
  const suggestedButton = createButton("Play Suggested");
  const passButton = createButton("Pass");
  const aiStepButton = createButton("AI Step");
  controls.append(finishRedrawButton, suggestedButton, passButton, aiStepButton);

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

  hud.append(status, controls, strip, inspect, hint);
  shell.appendChild(hud);
  root.appendChild(shell);

  let latestState = state;
  let latestInputBlocked = false;
  let latestInteraction: CardInteractionHudState = {
    validRows: [],
  };

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

  const update = (
    nextState: MatchState,
    inputBlocked: boolean,
    interaction?: CardInteractionHudState,
  ) => {
    latestState = nextState;
    latestInputBlocked = inputBlocked;
    latestInteraction = interaction ?? latestInteraction;
    const scores = calculateScores(nextState);
    const activePlayer = nextState.round.activePlayerId;
    const activeFaction = nextState.players[activePlayer].factionId;
    const suggestedAction = getSuggestedAction(nextState);

    phase.textContent = `Phase 11 card interaction. ${formatPhase(nextState.phase)}.`;
    detail.textContent = `Active: ${formatPlayer(activePlayer)} / ${activeFaction}. Round ${nextState.round.number}.`;
    phaseChip.value.textContent = formatPhase(nextState.phase);
    turnChip.value.textContent = formatPlayer(activePlayer);
    playerScoreChip.value.textContent = `${scores.player}`;
    opponentScoreChip.value.textContent = `${scores.opponent}`;
    handChip.value.textContent = `${nextState.players.player.hand.cards.length} / ${nextState.players.opponent.hand.cards.length}`;
    hint.textContent = getHintText(inputBlocked, latestInteraction);
    updateInspection(inspect, inspectTitle, inspectMeta, inspectAbilities, latestInteraction);

    finishRedrawButton.disabled = inputBlocked || nextState.phase !== "redraw" || !getNextRedrawPlayer(nextState);
    suggestedButton.disabled = inputBlocked || !suggestedAction;
    passButton.disabled = inputBlocked || nextState.phase !== "playing";
    aiStepButton.disabled = inputBlocked || !suggestedAction;
  };

  update(state, false);

  return {
    setInteraction(interaction) {
      update(latestState, latestInputBlocked, interaction);
    },
    update,
    dispose() {
      shell.remove();
    },
  };
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
    inspection.rows.length > 0 ? `Rows ${inspection.rows.join("/")}` : "No row target",
    `Zone ${inspection.zone}`,
  ].join(" | ");
  abilities.textContent = inspection.abilities.length > 0
    ? `Abilities: ${inspection.abilities.join(", ")}`
    : "Abilities: none";
}

function getHintText(inputBlocked: boolean, interaction: CardInteractionHudState): string {
  if (interaction.feedback) {
    return interaction.feedback;
  }

  if (inputBlocked) {
    return "Animation queue blocking input.";
  }

  if (interaction.selectedCardId && interaction.validRows.length > 0) {
    return "Choose a highlighted row or drag the selected card onto it.";
  }

  if (interaction.inspection) {
    return "Card inspected. Click again to use immediate specials or choose a valid row.";
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

function formatPhase(phase: MatchState["phase"]): string {
  return phase
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlayer(playerId: PlayerId): string {
  return playerId === "player" ? "Player" : "Opponent";
}
