import { FACTIONS } from "../data/factions";
import { resolveCardPlay } from "./abilityEngine";
import { createStarterDeck } from "./deckFactory";
import { appendEvent } from "./events";
import { createEmptyBoard, createEmptyMatchState } from "./matchState";
import { createRng, nextInt, shuffleWithRng } from "./random";
import { calculateScores } from "./scoring";
import type {
  CardDefinition,
  CardInstance,
  CardInstanceId,
  FactionId,
  MatchId,
  MatchPhase,
  MatchState,
  PlayerId,
  PlayerState,
  RowId,
} from "./types";

export type CreateMatchOptions = {
  id: MatchId;
  opponentFactionId?: FactionId;
  seed: string;
  playerFactionId: FactionId;
};

const OPENING_HAND_SIZE = 10;

export function createMatchFromFaction(options: CreateMatchOptions): MatchState {
  let rng = createRng(options.seed);
  const opponentCandidates = FACTIONS.filter((faction) => faction.id !== options.playerFactionId);
  const opponentFactionId = options.opponentFactionId && options.opponentFactionId !== options.playerFactionId
    ? options.opponentFactionId
    : undefined;
  const opponentPick = opponentFactionId ? undefined : nextInt(rng, opponentCandidates.length);

  if (opponentPick) {
    rng = opponentPick.rng;
  }

  const resolvedOpponentFactionId = opponentFactionId ?? opponentCandidates[opponentPick?.value ?? 0].id;
  const startingPlayer = chooseStartingPlayer(options.playerFactionId, resolvedOpponentFactionId, rng);
  rng = startingPlayer.rng;

  let state = createEmptyMatchState({
    id: options.id,
    seed: options.seed,
    playerFactionId: options.playerFactionId,
    opponentFactionId: resolvedOpponentFactionId,
    activePlayerId: startingPlayer.playerId,
  });

  state = {
    ...state,
    rng,
  };

  state = attachStarterDeck(state, "player", options.playerFactionId);
  state = attachStarterDeck(state, "opponent", resolvedOpponentFactionId);
  state = shuffleDeck(state, "player");
  state = shuffleDeck(state, "opponent");
  state = drawCards(state, "player", OPENING_HAND_SIZE, "opening-hand");
  state = drawCards(state, "opponent", OPENING_HAND_SIZE, "opening-hand");

  return setPhase(state, "redraw", {
    reason: "opening-hands-ready",
    activePlayerId: startingPlayer.playerId,
  });
}

export function redrawCard(state: MatchState, playerId: PlayerId, cardInstanceId: CardInstanceId): MatchState {
  assertPhase(state, "redraw");
  const player = state.players[playerId];

  if (player.hand.redrawComplete) {
    throw new Error(`${playerId} has already completed redraw.`);
  }

  if (player.hand.redrawsRemaining <= 0) {
    throw new Error(`${playerId} has no redraws remaining.`);
  }

  if (!player.hand.cards.includes(cardInstanceId)) {
    throw new Error(`${cardInstanceId} is not in ${playerId}'s hand.`);
  }

  if (player.deck.cards.length === 0) {
    throw new Error(`${playerId} cannot redraw with an empty deck.`);
  }

  const replacementCardId = player.deck.cards[0];
  const nextHandCards = player.hand.cards.map((id) =>
    id === cardInstanceId ? replacementCardId : id,
  );
  const nextDeckCards = [...player.deck.cards.slice(1), cardInstanceId];

  let nextState: MatchState = {
    ...state,
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...state.cards[cardInstanceId],
        zone: "deck",
      },
      [replacementCardId]: {
        ...state.cards[replacementCardId],
        zone: "hand",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        deck: {
          cards: nextDeckCards,
        },
        hand: {
          ...player.hand,
          cards: nextHandCards,
          redrawsRemaining: player.hand.redrawsRemaining - 1,
        },
      },
    },
  };

  nextState = appendEvent(nextState, "card.drawn", {
    playerId,
    cardInstanceId: replacementCardId,
    reason: "redraw",
  });

  return nextState;
}

export function finishRedraw(state: MatchState, playerId: PlayerId): MatchState {
  assertPhase(state, "redraw");
  const player = state.players[playerId];
  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: {
          ...player.hand,
          redrawComplete: true,
        },
      },
    },
  };

  nextState = appendEvent(nextState, "phase.changed", {
    playerId,
    redrawComplete: true,
  });

  if (nextState.players.player.hand.redrawComplete && nextState.players.opponent.hand.redrawComplete) {
    nextState = setPhase(nextState, "playing", {
      reason: "redraw-complete",
      activePlayerId: nextState.round.activePlayerId,
    });
  }

  return nextState;
}

export function playCard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  rowId?: RowId,
  targetCardInstanceId?: CardInstanceId,
): MatchState {
  assertPhase(state, "playing");
  assertActivePlayer(state, playerId);
  assertPlayerCanAct(state, playerId);

  const nextState = resolveCardPlay(state, {
    playerId,
    cardInstanceId,
    rowId,
    targetCardInstanceId,
  });

  return advanceAfterAction(nextState, playerId);
}

export function passRound(state: MatchState, playerId: PlayerId): MatchState {
  assertPhase(state, "playing");
  assertActivePlayer(state, playerId);

  const player = state.players[playerId];

  if (player.hasPassed) {
    throw new Error(`${playerId} has already passed.`);
  }

  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hasPassed: true,
      },
    },
    round: {
      ...state.round,
      passed: {
        ...state.round.passed,
        [playerId]: true,
      },
    },
  };

  nextState = appendEvent(nextState, "player.passed", {
    playerId,
  });

  return advanceAfterAction(nextState, playerId);
}

export function useLeaderAbility(
  state: MatchState,
  playerId: PlayerId,
  rowId?: RowId,
): MatchState {
  assertPhase(state, "playing");
  assertActivePlayer(state, playerId);
  assertPlayerCanAct(state, playerId);

  const player = state.players[playerId];

  if (player.leaderUsed) {
    throw new Error(`${playerId} has already used their leader ability.`);
  }

  if (!player.leaderCardId) {
    throw new Error(`${playerId} has no leader card.`);
  }

  const leaderDefinition = state.cardDefinitions[state.cards[player.leaderCardId].definitionId];

  if (leaderDefinition.type !== "leader") {
    throw new Error(`${leaderDefinition.name} is not a leader card.`);
  }

  let nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        leaderUsed: true,
      },
    },
  };

  nextState = appendEvent(
    nextState,
    "leader.used",
    {
      playerId,
      leaderCardInstanceId: player.leaderCardId,
      leaderDefinitionId: leaderDefinition.id,
      rowId,
    },
    true,
  );

  if (leaderDefinition.abilities.includes("weather")) {
    nextState = applyLeaderWeather(nextState, leaderDefinition, rowId);
  }

  if (leaderDefinition.tags.includes("leader:draw-extra-card")) {
    nextState = drawCards(nextState, playerId, 1, "leader");
  }

  return advanceAfterAction(nextState, playerId);
}

function attachStarterDeck(
  state: MatchState,
  playerId: PlayerId,
  factionId: FactionId,
): MatchState {
  const starterDeck = createStarterDeck(factionId);
  const definitions = [starterDeck.leader, ...starterDeck.deck];
  const cardDefinitions = {
    ...state.cardDefinitions,
    ...Object.fromEntries(definitions.map((definition) => [definition.id, definition])),
  };
  let nextCardInstanceSequence = state.nextCardInstanceSequence;
  const cardInstances: Record<CardInstanceId, CardInstance> = {};

  const leaderInstanceId = createCardInstanceId(playerId, nextCardInstanceSequence);
  nextCardInstanceSequence += 1;
  cardInstances[leaderInstanceId] = {
    id: leaderInstanceId,
    definitionId: starterDeck.leader.id,
    ownerId: playerId,
    controllerId: playerId,
    zone: "leader",
    createdSequence: nextCardInstanceSequence - 1,
  };

  const deckInstanceIds = starterDeck.deck.map((definition) => {
    const instanceId = createCardInstanceId(playerId, nextCardInstanceSequence);
    cardInstances[instanceId] = {
      id: instanceId,
      definitionId: definition.id,
      ownerId: playerId,
      controllerId: playerId,
      zone: "deck",
      createdSequence: nextCardInstanceSequence,
    };
    nextCardInstanceSequence += 1;
    return instanceId;
  });

  return {
    ...state,
    cardDefinitions,
    cards: {
      ...state.cards,
      ...cardInstances,
    },
    nextCardInstanceSequence,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        leaderCardId: leaderInstanceId,
        deck: {
          cards: deckInstanceIds,
        },
      },
    },
  };
}

function applyLeaderWeather(
  state: MatchState,
  leaderDefinition: CardDefinition,
  rowId?: RowId,
): MatchState {
  const affectedRows = leaderDefinition.rows.length > 0 ? leaderDefinition.rows : rowId ? [rowId] : [];

  if (affectedRows.length === 0) {
    throw new Error(`${leaderDefinition.name} requires a weather row target.`);
  }

  let nextState = state;

  for (const affectedRowId of affectedRows) {
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        weather: {
          ...nextState.board.weather,
          [affectedRowId]: true,
        },
      },
    };
    nextState = appendEvent(nextState, "weather.applied", {
      rowId: affectedRowId,
      sourceCardId: leaderDefinition.id,
      sourceType: "leader",
    });
  }

  return nextState;
}

function shuffleDeck(state: MatchState, playerId: PlayerId): MatchState {
  const player = state.players[playerId];
  const shuffled = shuffleWithRng(state.rng, player.deck.cards);

  return {
    ...state,
    rng: shuffled.rng,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        deck: {
          cards: shuffled.items,
        },
      },
    },
  };
}

function drawCards(
  state: MatchState,
  playerId: PlayerId,
  count: number,
  reason: string,
): MatchState {
  let nextState = state;

  for (let index = 0; index < count; index += 1) {
    const player = nextState.players[playerId];
    const cardInstanceId = player.deck.cards[0];

    if (!cardInstanceId) {
      return nextState;
    }

    nextState = {
      ...nextState,
      cards: {
        ...nextState.cards,
        [cardInstanceId]: {
          ...nextState.cards[cardInstanceId],
          zone: "hand",
        },
      },
      players: {
        ...nextState.players,
        [playerId]: {
          ...player,
          deck: {
            cards: player.deck.cards.slice(1),
          },
          hand: {
            ...player.hand,
            cards: [...player.hand.cards, cardInstanceId],
          },
        },
      },
    };

    nextState = appendEvent(nextState, "card.drawn", {
      playerId,
      cardInstanceId,
      reason,
    });
  }

  return nextState;
}

function advanceAfterAction(state: MatchState, actingPlayerId: PlayerId): MatchState {
  if (shouldEndRound(state)) {
    return resolveRound(state);
  }

  const nextPlayerId = chooseNextActivePlayer(state, actingPlayerId);
  const nextState: MatchState = {
    ...state,
    round: {
      ...state.round,
      activePlayerId: nextPlayerId,
    },
  };

  return appendEvent(nextState, "turn.changed", {
    activePlayerId: nextPlayerId,
  });
}

function resolveRound(state: MatchState): MatchState {
  const scores = calculateScores(state);
  const winnerIds = determineRoundWinners(state, scores);
  const playerWins = state.players.player.roundWins + (winnerIds.includes("player") ? 1 : 0);
  const opponentWins =
    state.players.opponent.roundWins + (winnerIds.includes("opponent") ? 1 : 0);
  const winnerId = playerWins >= 2 ? "player" : opponentWins >= 2 ? "opponent" : undefined;
  let rng = state.rng;
  const cleanup = cleanupBoardForNextRound({
    ...state,
    players: {
      player: {
        ...state.players.player,
        roundWins: playerWins,
      },
      opponent: {
        ...state.players.opponent,
        roundWins: opponentWins,
      },
    },
  }, winnerId === undefined);
  rng = cleanup.rng;

  let nextState: MatchState = {
    ...cleanup.state,
    rng,
    winnerId,
    phase: winnerId ? "match-complete" : "playing",
    round: winnerId
      ? {
          ...cleanup.state.round,
          phase: "match-complete",
          winnerIds,
        }
      : {
          number: cleanup.state.round.number + 1,
          phase: "playing",
          activePlayerId: winnerIds[0] ?? cleanup.state.round.activePlayerId,
          passed: {
            player: false,
            opponent: false,
          },
          winnerIds: [],
        },
    players: {
      player: {
        ...cleanup.state.players.player,
        hasPassed: false,
      },
      opponent: {
        ...cleanup.state.players.opponent,
        hasPassed: false,
      },
    },
  };

  nextState = appendEvent(nextState, "round.ended", {
    roundNumber: state.round.number,
    scores,
    winnerIds,
  }, true);

  if (winnerId) {
    nextState = appendEvent(nextState, "match.ended", {
      winnerId,
    }, true);
  } else {
    nextState = applyNorthernRealmsRoundWinDraw(nextState, winnerIds);
    nextState = appendEvent(nextState, "phase.changed", {
      phase: "playing",
      roundNumber: nextState.round.number,
      activePlayerId: nextState.round.activePlayerId,
    });
  }

  return nextState;
}

function applyNorthernRealmsRoundWinDraw(state: MatchState, winnerIds: PlayerId[]): MatchState {
  let nextState = state;

  for (const winnerId of winnerIds) {
    if (nextState.players[winnerId].factionId === "northern-realms") {
      nextState = drawCards(nextState, winnerId, 1, "faction:northern-realms");
    }
  }

  return nextState;
}

function cleanupBoardForNextRound(
  state: MatchState,
  allowMonsterCarryover: boolean,
): { state: MatchState; rng: MatchState["rng"] } {
  let rng = state.rng;
  const keepByPlayer: Record<PlayerId, Set<CardInstanceId>> = {
    player: new Set(),
    opponent: new Set(),
  };

  if (allowMonsterCarryover) {
    for (const playerId of ["player", "opponent"] as const) {
      if (state.players[playerId].factionId !== "monsters") {
        continue;
      }

      const unitCards = getBoardCardIds(state, playerId).filter((cardInstanceId) => {
        const definition = state.cardDefinitions[state.cards[cardInstanceId].definitionId];
        return definition.type === "unit";
      });

      if (unitCards.length > 0) {
        const pick = nextInt(rng, unitCards.length);
        rng = pick.rng;
        keepByPlayer[playerId].add(unitCards[pick.value]);
      }
    }
  }

  const cards = { ...state.cards };
  const players: Record<PlayerId, PlayerState> = {
    player: {
      ...state.players.player,
      discard: {
        cards: [...state.players.player.discard.cards],
      },
    },
    opponent: {
      ...state.players.opponent,
      discard: {
        cards: [...state.players.opponent.discard.cards],
      },
    },
  };
  const board = createEmptyBoard();

  for (const playerId of ["player", "opponent"] as const) {
    for (const rowId of ["close", "ranged", "siege"] as const) {
      for (const cardInstanceId of state.board.rows[playerId][rowId].cards) {
        if (keepByPlayer[playerId].has(cardInstanceId)) {
          board.rows[playerId][rowId].cards.push(cardInstanceId);
          cards[cardInstanceId] = {
            ...cards[cardInstanceId],
            rowId,
            zone: "board",
          };
          continue;
        }

        const ownerId = cards[cardInstanceId].ownerId;
        cards[cardInstanceId] = {
          ...cards[cardInstanceId],
          rowId: undefined,
          zone: "discard",
        };
        players[ownerId].discard.cards.push(cardInstanceId);
      }
    }
  }

  return {
    rng,
    state: {
      ...state,
      board,
      cards,
      players,
    },
  };
}

function determineRoundWinners(state: MatchState, scores: Record<PlayerId, number>): PlayerId[] {
  if (scores.player > scores.opponent) {
    return ["player"];
  }

  if (scores.opponent > scores.player) {
    return ["opponent"];
  }

  if (state.players.player.factionId === "nilfgaardian-empire") {
    return ["player"];
  }

  if (state.players.opponent.factionId === "nilfgaardian-empire") {
    return ["opponent"];
  }

  return [];
}

function shouldEndRound(state: MatchState): boolean {
  return !canPlayerAct(state, "player") && !canPlayerAct(state, "opponent");
}

function canPlayerAct(state: MatchState, playerId: PlayerId): boolean {
  return !state.players[playerId].hasPassed && state.players[playerId].hand.cards.length > 0;
}

function chooseNextActivePlayer(state: MatchState, actingPlayerId: PlayerId): PlayerId {
  const otherPlayerId = actingPlayerId === "player" ? "opponent" : "player";

  if (canPlayerAct(state, otherPlayerId)) {
    return otherPlayerId;
  }

  return actingPlayerId;
}

function chooseStartingPlayer(
  playerFactionId: FactionId,
  opponentFactionId: FactionId,
  rng: MatchState["rng"],
): { rng: MatchState["rng"]; playerId: PlayerId } {
  if (playerFactionId === "scoiatael") {
    return {
      rng,
      playerId: "player",
    };
  }

  if (opponentFactionId === "scoiatael") {
    return {
      rng,
      playerId: "opponent",
    };
  }

  const pick = nextInt(rng, 2);

  return {
    rng: pick.rng,
    playerId: pick.value === 0 ? "player" : "opponent",
  };
}

function setPhase(
  state: MatchState,
  phase: MatchPhase,
  payload: Record<string, unknown>,
): MatchState {
  const nextState: MatchState = {
    ...state,
    phase,
    round: {
      ...state.round,
      phase,
    },
  };

  return appendEvent(nextState, "phase.changed", {
    phase,
    ...payload,
  });
}

function getBoardCardIds(state: MatchState, playerId: PlayerId): CardInstanceId[] {
  return Object.values(state.board.rows[playerId]).flatMap((row) => row.cards);
}

function assertPhase(state: MatchState, phase: MatchPhase) {
  if (state.phase !== phase) {
    throw new Error(`Expected match phase ${phase}, received ${state.phase}.`);
  }
}

function assertActivePlayer(state: MatchState, playerId: PlayerId) {
  if (state.round.activePlayerId !== playerId) {
    throw new Error(`Expected active player ${state.round.activePlayerId}, received ${playerId}.`);
  }
}

function assertPlayerCanAct(state: MatchState, playerId: PlayerId) {
  if (!canPlayerAct(state, playerId)) {
    throw new Error(`${playerId} cannot act.`);
  }
}

function createCardInstanceId(playerId: PlayerId, sequence: number): CardInstanceId {
  return `${playerId}-card-${sequence.toString().padStart(4, "0")}`;
}
