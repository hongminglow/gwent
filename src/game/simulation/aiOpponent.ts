import type { GameAction } from "./actions";
import { matchReducer } from "./reducer";
import { calculateScoreBreakdown, calculateScores } from "./scoring";
import type {
  AbilityId,
  CardDefinition,
  CardInstanceId,
  MatchState,
  PlayerId,
  RowId,
} from "./types";

const ROWS = ["close", "ranged", "siege"] as const;

export type AiDifficulty = "easy" | "standard" | "hard";

export type AiTuning = {
  redrawValueCeiling: number;
  passScoreMargin: number;
  sacrificeScoreGap: number;
  minimumActionScore: number;
  spyPriority: number;
  medicPriority: number;
  scorchPriority: number;
  weatherPriority: number;
  hornPriority: number;
  leaderPriority: number;
  maxAutoplayActions: number;
  autoplayEnabled: boolean;
};

export type AiDecisionOptions = {
  difficulty?: AiDifficulty;
  tuning?: Partial<AiTuning>;
};

export type AiActionCandidate = {
  action: GameAction;
  score: number;
  reason: string;
};

export type AiDecision = AiActionCandidate & {
  candidates: AiActionCandidate[];
};

export type ScoreProjection = {
  before: Record<PlayerId, number>;
  after: Record<PlayerId, number>;
  scoreSwing: number;
  state: MatchState;
};

export type AiAutoplayOptions = AiDecisionOptions & {
  controlledPlayers?: PlayerId[];
  enabled?: boolean;
  maxActions?: number;
};

export type AiAutoplayResult = {
  state: MatchState;
  decisions: AiDecision[];
  stoppedReason: "disabled" | "match-complete" | "waiting-for-player" | "no-legal-action" | "max-actions";
};

export const AI_DIFFICULTY_CONFIGS: Record<AiDifficulty, AiTuning> = {
  easy: {
    redrawValueCeiling: 3,
    passScoreMargin: 12,
    sacrificeScoreGap: 22,
    minimumActionScore: 1,
    spyPriority: 13,
    medicPriority: 5,
    scorchPriority: 2,
    weatherPriority: 1,
    hornPriority: 3,
    leaderPriority: 1,
    maxAutoplayActions: 120,
    autoplayEnabled: false,
  },
  standard: {
    redrawValueCeiling: 5,
    passScoreMargin: 8,
    sacrificeScoreGap: 16,
    minimumActionScore: 0,
    spyPriority: 20,
    medicPriority: 8,
    scorchPriority: 5,
    weatherPriority: 4,
    hornPriority: 6,
    leaderPriority: 4,
    maxAutoplayActions: 180,
    autoplayEnabled: false,
  },
  hard: {
    redrawValueCeiling: 6,
    passScoreMargin: 5,
    sacrificeScoreGap: 12,
    minimumActionScore: -2,
    spyPriority: 24,
    medicPriority: 11,
    scorchPriority: 8,
    weatherPriority: 7,
    hornPriority: 8,
    leaderPriority: 6,
    maxAutoplayActions: 240,
    autoplayEnabled: false,
  },
};

export function generateLegalActions(state: MatchState, playerId: PlayerId): GameAction[] {
  const player = state.players[playerId];

  if (state.phase === "redraw") {
    if (player.hand.redrawComplete) {
      return [];
    }

    const redrawActions: GameAction[] =
      player.hand.redrawsRemaining > 0 && player.deck.cards.length > 0
        ? player.hand.cards.map((cardInstanceId) => ({
            type: "redraw-card",
            playerId,
            cardInstanceId,
          }))
        : [];

    return [...redrawActions, { type: "finish-redraw", playerId }];
  }

  if (state.phase !== "playing" || state.round.activePlayerId !== playerId || player.hasPassed) {
    return [];
  }

  const actions: GameAction[] = [{ type: "pass-round", playerId }];

  if (!player.leaderUsed && player.leaderCardId) {
    actions.push(...generateLeaderActions(state, playerId));
  }

  for (const cardInstanceId of player.hand.cards) {
    const definition = getDefinition(state, cardInstanceId);

    if (definition.type === "special") {
      actions.push(...generateSpecialActions(state, playerId, cardInstanceId, definition));
      continue;
    }

    actions.push(...generateUnitActions(state, playerId, cardInstanceId, definition));
  }

  return actions;
}

export function chooseAiAction(
  state: MatchState,
  playerId: PlayerId,
  options: AiDecisionOptions = {},
): AiDecision | undefined {
  const actions = generateLegalActions(state, playerId);

  if (actions.length === 0) {
    return undefined;
  }

  const tuning = resolveAiTuning(options);

  if (state.phase === "redraw") {
    return chooseRedrawAction(state, playerId, actions, tuning);
  }

  const passReason = getPassReason(state, playerId, tuning);
  const passAction = actions.find((action) => action.type === "pass-round");

  if (passReason && passAction) {
    const passCandidate = evaluateAiAction(state, playerId, passAction, tuning, passReason);
    return {
      ...passCandidate,
      candidates: [passCandidate],
    };
  }

  const candidates = actions
    .filter((action) => action.type !== "pass-round")
    .map((action) => evaluateAiAction(state, playerId, action, tuning))
    .sort(compareCandidates);
  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    return passAction
      ? {
          ...evaluateAiAction(state, playerId, passAction, tuning, "no playable action"),
          candidates,
        }
      : undefined;
  }

  if (passAction && bestCandidate.score < tuning.minimumActionScore && calculateScores(state)[playerId] > 0) {
    const passCandidate = evaluateAiAction(state, playerId, passAction, tuning, "conserve cards");
    return {
      ...passCandidate,
      candidates: [passCandidate, ...candidates],
    };
  }

  return {
    ...bestCandidate,
    candidates,
  };
}

export function selectAiAction(
  state: MatchState,
  playerId: PlayerId,
  options: AiDecisionOptions = {},
): GameAction | undefined {
  return chooseAiAction(state, playerId, options)?.action;
}

export function projectActionScore(
  state: MatchState,
  playerId: PlayerId,
  action: GameAction,
): ScoreProjection {
  const before = calculateScores(state);
  const projectedState = matchReducer(state, action);
  const after = calculateScores(projectedState);
  const opponentId = getOpponentId(playerId);

  return {
    before,
    after,
    scoreSwing: after[playerId] - after[opponentId] - (before[playerId] - before[opponentId]),
    state: projectedState,
  };
}

export function evaluateCardValue(state: MatchState, cardInstanceId: CardInstanceId): number {
  const definition = getDefinition(state, cardInstanceId);
  let value = definition.basePower;

  for (const ability of definition.abilities) {
    switch (ability) {
      case "spy":
        value += 9;
        break;
      case "medic":
        value += 7;
        break;
      case "muster":
        value += 6;
        break;
      case "scorch":
        value += 6;
        break;
      case "commanders-horn":
        value += 5;
        break;
      case "weather":
      case "clear-weather":
        value += 4;
        break;
      case "tight-bond":
      case "morale-boost":
        value += 3;
        break;
      case "decoy":
      case "agile":
        value += 2;
        break;
      case "hero":
        value += 8;
        break;
      default:
        assertNever(ability);
    }
  }

  return value;
}

export function runAiAutoplay(
  state: MatchState,
  options: AiAutoplayOptions = {},
): AiAutoplayResult {
  const tuning = resolveAiTuning(options);
  const enabled = options.enabled ?? true;

  if (!enabled) {
    return {
      state,
      decisions: [],
      stoppedReason: "disabled",
    };
  }

  const controlledPlayers = options.controlledPlayers ?? ["opponent"];
  const maxActions = options.maxActions ?? tuning.maxAutoplayActions;
  const decisions: AiDecision[] = [];
  let nextState = state;

  for (let index = 0; index < maxActions; index += 1) {
    if (nextState.phase === "match-complete") {
      return {
        state: nextState,
        decisions,
        stoppedReason: "match-complete",
      };
    }

    const playerId = getAutoplayPlayer(nextState, controlledPlayers);

    if (!playerId) {
      return {
        state: nextState,
        decisions,
        stoppedReason: "waiting-for-player",
      };
    }

    const decision = chooseAiAction(nextState, playerId, options);

    if (!decision) {
      return {
        state: nextState,
        decisions,
        stoppedReason: "no-legal-action",
      };
    }

    decisions.push(decision);
    nextState = matchReducer(nextState, decision.action);
  }

  return {
    state: nextState,
    decisions,
    stoppedReason: "max-actions",
  };
}

function chooseRedrawAction(
  state: MatchState,
  playerId: PlayerId,
  actions: GameAction[],
  tuning: AiTuning,
): AiDecision {
  const candidates = actions.map((action) => evaluateAiAction(state, playerId, action, tuning));
  const redrawCandidates = candidates
    .filter((candidate) => candidate.action.type === "redraw-card")
    .sort(compareCandidates);
  const bestRedraw = redrawCandidates[0];
  const finish = candidates.find((candidate) => candidate.action.type === "finish-redraw");

  if (bestRedraw && -bestRedraw.score <= tuning.redrawValueCeiling) {
    return {
      ...bestRedraw,
      candidates,
    };
  }

  return {
    ...(finish ?? candidates[0]),
    candidates,
  };
}

function evaluateAiAction(
  state: MatchState,
  playerId: PlayerId,
  action: GameAction,
  tuning: AiTuning,
  forcedReason?: string,
): AiActionCandidate {
  if (action.type === "finish-redraw") {
    return {
      action,
      score: 0,
      reason: forcedReason ?? "finish redraw",
    };
  }

  if (action.type === "redraw-card") {
    return {
      action,
      score: -evaluateCardValue(state, action.cardInstanceId),
      reason: forcedReason ?? "redraw lowest-value card",
    };
  }

  if (action.type === "pass-round") {
    return {
      action,
      score: 0,
      reason: forcedReason ?? "pass",
    };
  }

  try {
    const projection = projectActionScore(state, playerId, action);
    const abilityScore = getAbilityScore(state, playerId, action, tuning);
    const factionScore = getFactionScore(state, playerId, action);

    return {
      action,
      score: projection.scoreSwing + abilityScore + factionScore,
      reason: forcedReason ?? getActionReason(state, action),
    };
  } catch {
    return {
      action,
      score: Number.NEGATIVE_INFINITY,
      reason: "illegal projection",
    };
  }
}

function getAbilityScore(
  state: MatchState,
  playerId: PlayerId,
  action: GameAction,
  tuning: AiTuning,
): number {
  if (action.type === "use-leader") {
    const leaderDefinition = getLeaderDefinition(state, playerId);
    const weatherImpact = leaderDefinition.abilities.includes("weather")
      ? evaluateWeatherImpact(state, playerId, leaderDefinition.rows.length > 0 ? leaderDefinition.rows : action.rowId ? [action.rowId] : [])
      : 0;
    return tuning.leaderPriority + weatherImpact;
  }

  if (action.type !== "play-card") {
    return 0;
  }

  const definition = getDefinition(state, action.cardInstanceId);
  let score = 0;

  for (const ability of definition.abilities) {
    switch (ability) {
      case "spy":
        score += tuning.spyPriority + Math.min(2, state.players[playerId].deck.cards.length) * 3;
        break;
      case "medic":
        score += tuning.medicPriority + getTargetPower(state, action.targetCardInstanceId);
        break;
      case "muster":
        score += countMatchingMusterCards(state, playerId, action.cardInstanceId) * 4;
        break;
      case "scorch": {
        const scorchSwing = evaluateScorchSwing(state, playerId);
        score += scorchSwing > 0 ? tuning.scorchPriority + scorchSwing : -40;
        break;
      }
      case "weather": {
        const rows = definition.rows.length > 0 ? definition.rows : action.rowId ? [action.rowId] : [];
        const impact = evaluateWeatherImpact(state, playerId, rows);
        score += impact > 0 ? tuning.weatherPriority + impact : -12;
        break;
      }
      case "clear-weather":
        score += getClearWeatherScore(state, playerId);
        break;
      case "commanders-horn":
        score += tuning.hornPriority + (action.rowId ? getRowUnitPower(state, playerId, action.rowId) : 0);
        break;
      case "tight-bond":
      case "morale-boost":
      case "hero":
      case "agile":
      case "decoy":
        break;
      default:
        assertNever(ability);
    }
  }

  if (definition.abilities.includes("decoy")) {
    score += getDecoyScore(state, action.targetCardInstanceId);
  }

  return score;
}

function getPassReason(state: MatchState, playerId: PlayerId, tuning: AiTuning): string | undefined {
  const opponentId = getOpponentId(playerId);
  const player = state.players[playerId];
  const opponent = state.players[opponentId];
  const scores = calculateScores(state);
  const scoreGap = scores[playerId] - scores[opponentId];

  if (opponent.hasPassed && player.factionId === "nilfgaardian-empire" && scoreGap >= 0) {
    return "Nilfgaard tie or lead after opponent passed";
  }

  if (opponent.hasPassed && scoreGap > 0) {
    return "lock round after opponent passed";
  }

  if (player.hand.cards.length === 0) {
    return "no hand cards left";
  }

  if (opponent.roundWins === 0 && scoreGap <= -tuning.sacrificeScoreGap) {
    return "sacrifice overcommitted round";
  }

  if (scoreGap >= tuning.passScoreMargin && player.hand.cards.length <= opponent.hand.cards.length) {
    return "protect card advantage";
  }

  return undefined;
}

function generateUnitActions(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  definition: CardDefinition,
): GameAction[] {
  const reviveTargets = definition.abilities.includes("medic")
    ? getMedicTargets(state, playerId)
    : [];
  const actions: GameAction[] = [];

  for (const rowId of definition.rows) {
    if (reviveTargets.length === 0) {
      actions.push({
        type: "play-card",
        playerId,
        cardInstanceId,
        rowId,
      });
      continue;
    }

    for (const targetCardInstanceId of reviveTargets) {
      actions.push({
        type: "play-card",
        playerId,
        cardInstanceId,
        rowId,
        targetCardInstanceId,
      });
    }
  }

  return actions;
}

function generateSpecialActions(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  definition: CardDefinition,
): GameAction[] {
  if (definition.abilities.includes("decoy")) {
    return getDecoyTargets(state, playerId).map((targetCardInstanceId) => ({
      type: "play-card",
      playerId,
      cardInstanceId,
      targetCardInstanceId,
    }));
  }

  if (definition.abilities.includes("commanders-horn")) {
    return ROWS.filter((rowId) => !state.board.rows[playerId][rowId].hornActive).map((rowId) => ({
      type: "play-card",
      playerId,
      cardInstanceId,
      rowId,
    }));
  }

  if (definition.abilities.includes("weather") && definition.rows.length === 0) {
    return ROWS.map((rowId) => ({
      type: "play-card",
      playerId,
      cardInstanceId,
      rowId,
    }));
  }

  return [
    {
      type: "play-card",
      playerId,
      cardInstanceId,
    },
  ];
}

function generateLeaderActions(state: MatchState, playerId: PlayerId): GameAction[] {
  const leaderDefinition = getLeaderDefinition(state, playerId);

  if (leaderDefinition.tags.includes("leader:draw-extra-card")) {
    return state.players[playerId].deck.cards.length > 0
      ? [{ type: "use-leader", playerId }]
      : [];
  }

  if (leaderDefinition.abilities.includes("weather")) {
    if (leaderDefinition.rows.length > 0) {
      return [{ type: "use-leader", playerId }];
    }

    return ROWS.filter((rowId) => !state.board.weather[rowId]).map((rowId) => ({
      type: "use-leader",
      playerId,
      rowId,
    }));
  }

  return [];
}

function getMedicTargets(state: MatchState, playerId: PlayerId): CardInstanceId[] {
  return state.players[playerId].discard.cards.filter((cardInstanceId) => {
    const definition = getDefinition(state, cardInstanceId);
    return definition.type === "unit" && !definition.abilities.includes("hero");
  });
}

function getDecoyTargets(state: MatchState, playerId: PlayerId): CardInstanceId[] {
  return ROWS.flatMap((rowId) =>
    state.board.rows[playerId][rowId].cards.filter((cardInstanceId) => {
      const definition = getDefinition(state, cardInstanceId);
      return definition.type !== "hero" && !definition.abilities.includes("hero");
    }),
  );
}

function getActionReason(state: MatchState, action: GameAction): string {
  if (action.type === "use-leader") {
    return "leader ability";
  }

  if (action.type !== "play-card") {
    return action.type;
  }

  const definition = getDefinition(state, action.cardInstanceId);
  const priorityAbility = definition.abilities.find((ability) =>
    ["spy", "medic", "scorch", "weather", "commanders-horn", "muster", "decoy"].includes(ability),
  );

  return priorityAbility ? `${priorityAbility} play` : "best score projection";
}

function getFactionScore(state: MatchState, playerId: PlayerId, action: GameAction): number {
  if (action.type !== "play-card") {
    return 0;
  }

  const factionId = state.players[playerId].factionId;
  const definition = getDefinition(state, action.cardInstanceId);

  switch (factionId) {
    case "northern-realms":
      return scoreIfHasAbility(definition, "spy", 2) + scoreIfHasAbility(definition, "tight-bond", 1);
    case "nilfgaardian-empire":
      return scoreIfHasAbility(definition, "spy", 2) + scoreIfHasAbility(definition, "medic", 2);
    case "scoiatael":
      return scoreIfHasAbility(definition, "agile", 2);
    case "monsters":
      return scoreIfHasAbility(definition, "muster", 3);
    default:
      return assertNever(factionId);
  }
}

function scoreIfHasAbility(definition: CardDefinition, abilityId: AbilityId, score: number): number {
  return definition.abilities.includes(abilityId) ? score : 0;
}

function evaluateScorchSwing(state: MatchState, playerId: PlayerId): number {
  const breakdown = calculateScoreBreakdown(state);
  const candidates = (["player", "opponent"] as const).flatMap((controllerId) =>
    ROWS.flatMap((rowId) =>
      breakdown[controllerId].rows[rowId].cards.filter((card) => {
        const definition = state.cardDefinitions[card.definitionId];
        return definition.type === "unit" && !definition.abilities.includes("hero") && card.finalPower > 0;
      }).map((card) => ({
        controllerId,
        finalPower: card.finalPower,
      })),
    ),
  );

  if (candidates.length === 0) {
    return 0;
  }

  const highestPower = Math.max(...candidates.map((candidate) => candidate.finalPower));
  const destroyed = candidates.filter((candidate) => candidate.finalPower === highestPower);
  const opponentId = getOpponentId(playerId);
  const opponentLoss = destroyed
    .filter((candidate) => candidate.controllerId === opponentId)
    .reduce((sum, candidate) => sum + candidate.finalPower, 0);
  const ownLoss = destroyed
    .filter((candidate) => candidate.controllerId === playerId)
    .reduce((sum, candidate) => sum + candidate.finalPower, 0);

  return opponentLoss - ownLoss;
}

function evaluateWeatherImpact(state: MatchState, playerId: PlayerId, rows: RowId[]): number {
  const breakdown = calculateScoreBreakdown(state);
  const opponentId = getOpponentId(playerId);
  let ownLoss = 0;
  let opponentLoss = 0;

  for (const rowId of rows) {
    ownLoss += getWeatherRowLoss(state, breakdown[playerId].rows[rowId].cards);
    opponentLoss += getWeatherRowLoss(state, breakdown[opponentId].rows[rowId].cards);
  }

  return opponentLoss - ownLoss;
}

function getWeatherRowLoss(
  state: MatchState,
  cards: { definitionId: string; finalPower: number }[],
): number {
  return cards.reduce((sum, card) => {
    const definition = state.cardDefinitions[card.definitionId];

    if (definition.type !== "unit" || definition.abilities.includes("hero")) {
      return sum;
    }

    return sum + Math.max(0, card.finalPower - 1);
  }, 0);
}

function getClearWeatherScore(state: MatchState, playerId: PlayerId): number {
  const activeRows = ROWS.filter((rowId) => state.board.weather[rowId]);

  if (activeRows.length === 0) {
    return -10;
  }

  return -evaluateWeatherImpact(state, playerId, activeRows);
}

function getRowUnitPower(state: MatchState, playerId: PlayerId, rowId: RowId): number {
  return calculateScoreBreakdown(state)[playerId].rows[rowId].cards
    .filter((card) => {
      const definition = state.cardDefinitions[card.definitionId];
      return definition.type === "unit" && !definition.abilities.includes("hero");
    })
    .reduce((sum, card) => sum + card.finalPower, 0);
}

function getDecoyScore(state: MatchState, targetCardInstanceId?: CardInstanceId): number {
  if (!targetCardInstanceId) {
    return -20;
  }

  const definition = getDefinition(state, targetCardInstanceId);

  if (definition.abilities.includes("spy")) {
    return 16;
  }

  if (definition.abilities.includes("medic")) {
    return 11;
  }

  return Math.max(0, definition.basePower - 2);
}

function getTargetPower(state: MatchState, targetCardInstanceId?: CardInstanceId): number {
  return targetCardInstanceId ? getDefinition(state, targetCardInstanceId).basePower : 0;
}

function countMatchingMusterCards(
  state: MatchState,
  playerId: PlayerId,
  sourceCardInstanceId: CardInstanceId,
): number {
  const sourceKey = getMusterKey(state, sourceCardInstanceId);

  return state.players[playerId].deck.cards.filter(
    (cardInstanceId) => getMusterKey(state, cardInstanceId) === sourceKey,
  ).length;
}

function getMusterKey(state: MatchState, cardInstanceId: CardInstanceId): string {
  const definition = getDefinition(state, cardInstanceId);
  return definition.tags.find((tag) => tag.startsWith("muster:")) ?? definition.name;
}

function getAutoplayPlayer(state: MatchState, controlledPlayers: PlayerId[]): PlayerId | undefined {
  if (state.phase === "redraw") {
    return controlledPlayers.find((playerId) => !state.players[playerId].hand.redrawComplete);
  }

  if (state.phase === "playing" && controlledPlayers.includes(state.round.activePlayerId)) {
    return state.round.activePlayerId;
  }

  return undefined;
}

function resolveAiTuning(options: AiDecisionOptions): AiTuning {
  const difficulty = options.difficulty ?? "standard";

  return {
    ...AI_DIFFICULTY_CONFIGS[difficulty],
    ...options.tuning,
  };
}

function compareCandidates(a: AiActionCandidate, b: AiActionCandidate): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return getActionSortKey(a.action).localeCompare(getActionSortKey(b.action));
}

function getActionSortKey(action: GameAction): string {
  switch (action.type) {
    case "play-card":
      return `${action.type}:${action.cardInstanceId}:${action.rowId ?? ""}:${action.targetCardInstanceId ?? ""}`;
    case "redraw-card":
      return `${action.type}:${action.cardInstanceId}`;
    case "finish-redraw":
    case "pass-round":
    case "start-redraw":
    case "clear-event-log":
      return action.type;
    case "use-leader":
      return `${action.type}:${action.rowId ?? ""}`;
    default:
      return assertNever(action);
  }
}

function getDefinition(state: MatchState, cardInstanceId: CardInstanceId): CardDefinition {
  const card = state.cards[cardInstanceId];

  if (!card) {
    throw new Error(`Unknown card instance: ${cardInstanceId}`);
  }

  return state.cardDefinitions[card.definitionId];
}

function getLeaderDefinition(state: MatchState, playerId: PlayerId): CardDefinition {
  const leaderCardId = state.players[playerId].leaderCardId;

  if (!leaderCardId) {
    throw new Error(`${playerId} has no leader card.`);
  }

  return getDefinition(state, leaderCardId);
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "opponent" : "player";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled AI value: ${JSON.stringify(value)}`);
}
