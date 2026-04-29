import { CARD_DEFINITIONS_BY_ID } from "../data/cards";
import { appendEvent } from "./events";
import { createEmptyBoard } from "./matchState";
import { calculateScores } from "./scoring";
import type {
  AbilityId,
  BoardState,
  CardDefinition,
  CardInstance,
  CardInstanceId,
  MatchState,
  PlayerId,
  RowId,
} from "./types";

export const DEBUG_HAND_PRESETS: Record<PlayerId, string[]> = {
  player: [
    "neutral-scorch",
    "neutral-commanders-horn",
    "neutral-biting-frost",
    "nr-blue-stripes-commando",
    "nr-blue-stripes-commando",
    "nr-dun-banner-medic",
    "nr-prince-stennis",
    "nr-vernon-roche",
    "nr-kaedweni-siege-expert",
    "neutral-clear-weather",
  ],
  opponent: [
    "neutral-scorch",
    "neutral-commanders-horn",
    "neutral-torrential-rain",
    "ng-black-infantry-archer",
    "ng-impera-brigade-guard",
    "ng-impera-brigade-guard",
    "ng-etolian-auxiliary-archers",
    "ng-stefan-skellen",
    "ng-letho",
    "neutral-clear-weather",
  ],
};

const ROWS: RowId[] = ["close", "ranged", "siege"];

const REPRESENTATIVE_ABILITY_CARDS: Record<AbilityId, string> = {
  agile: "st-dol-blathanna-scout",
  "clear-weather": "neutral-clear-weather",
  "commanders-horn": "neutral-commanders-horn",
  decoy: "neutral-decoy",
  hero: "nr-vernon-roche",
  medic: "nr-dun-banner-medic",
  "morale-boost": "nr-kaedweni-siege-expert",
  muster: "mo-ghoul",
  scorch: "neutral-scorch",
  spy: "nr-prince-stennis",
  "tight-bond": "nr-blue-stripes-commando",
  weather: "neutral-biting-frost",
};

export function debugForceHand(
  state: MatchState,
  playerId: PlayerId,
  definitionIds = DEBUG_HAND_PRESETS[playerId],
): MatchState {
  let nextState = ensurePlaying(state);
  const player = nextState.players[playerId];
  const existingHandCards = player.hand.cards;
  const cards = { ...nextState.cards };

  for (const cardInstanceId of existingHandCards) {
    cards[cardInstanceId] = {
      ...cards[cardInstanceId],
      rowId: undefined,
      zone: "deck",
    };
  }

  nextState = {
    ...nextState,
    cards,
    players: {
      ...nextState.players,
      [playerId]: {
        ...player,
        deck: {
          cards: [...player.deck.cards, ...existingHandCards],
        },
        hand: {
          cards: [],
          redrawComplete: true,
          redrawsRemaining: 0,
        },
      },
    },
  };

  for (const definitionId of definitionIds) {
    nextState = addDebugCard(nextState, {
      definitionId,
      playerId,
      zone: "hand",
      emitEvent: false,
    });
  }

  return appendEvent(nextState, "phase.changed", {
    debug: true,
    playerId,
    reason: "debug-force-hand",
  });
}

export function debugSpawnCard(
  state: MatchState,
  options: {
    definitionId: string;
    playerId: PlayerId;
    rowId?: RowId;
    zone: "hand" | "board";
  },
): MatchState {
  return addDebugCard(ensurePlaying(state), {
    ...options,
    emitEvent: true,
  });
}

export function debugTriggerAbility(
  state: MatchState,
  options: {
    abilityId: AbilityId;
    playerId: PlayerId;
    rowId?: RowId;
  },
): MatchState {
  const rowId = options.rowId ?? "close";

  switch (options.abilityId) {
    case "weather":
      return debugApplyWeather(state, rowId);
    case "clear-weather":
      return debugClearWeather(state);
    case "commanders-horn":
      return debugApplyHorn(state, options.playerId, rowId);
    case "scorch":
      return debugTriggerScorch(state, options.playerId, rowId);
    case "decoy":
      return debugPlaySpecial(state, options.playerId, "neutral-decoy");
    case "medic":
      return debugPlayAbilityCard(state, options.playerId, "nr-dun-banner-medic", "siege", "medic");
    case "spy":
      return debugPlayAbilityCard(state, options.playerId, "nr-prince-stennis", "close", "spy");
    case "muster":
      return debugPlayAbilityCard(state, options.playerId, "mo-ghoul", "close", "muster");
    case "tight-bond":
      return debugPlayAbilityCard(state, options.playerId, "nr-blue-stripes-commando", "close");
    case "morale-boost":
      return debugPlayAbilityCard(state, options.playerId, "nr-kaedweni-siege-expert", "siege");
    case "hero":
      return debugPlayAbilityCard(state, options.playerId, "nr-vernon-roche", "close");
    case "agile":
      return debugPlayAbilityCard(state, options.playerId, "st-dol-blathanna-scout", rowId);
    default:
      return assertNever(options.abilityId);
  }
}

export function debugTriggerScorch(state: MatchState, playerId: PlayerId, rowId: RowId = "close"): MatchState {
  let nextState = ensurePlaying(state);
  let candidates = getDestroyableBoardCards(nextState);

  if (candidates.length === 0) {
    nextState = addDebugCard(nextState, {
      definitionId: "ng-black-infantry-archer",
      emitEvent: true,
      playerId,
      rowId,
      zone: "board",
    });
    candidates = getDestroyableBoardCards(nextState);
  }

  const highestPower = Math.max(...candidates.map((candidate) => candidate.basePower));
  const destroyedCards = candidates.filter((candidate) => candidate.basePower === highestPower);

  return destroyedCards.reduce(
    (workingState, candidate) =>
      destroyBoardCard(workingState, candidate.controllerId, candidate.rowId, candidate.cardInstanceId, "debug-scorch"),
    nextState,
  );
}

export function debugTriggerSlain(state: MatchState, playerId: PlayerId, rowId: RowId = "close"): MatchState {
  let nextState = ensurePlaying(state);
  let target = getDestroyableBoardCards(nextState)[0];

  if (!target) {
    nextState = addDebugCard(nextState, {
      definitionId: "mo-fiend",
      emitEvent: true,
      playerId,
      rowId,
      zone: "board",
    });
    target = getDestroyableBoardCards(nextState)[0];
  }

  if (!target) {
    return nextState;
  }

  return destroyBoardCard(nextState, target.controllerId, target.rowId, target.cardInstanceId, "debug-slain");
}

export function debugSkipRound(state: MatchState, winnerId?: PlayerId): MatchState {
  const playingState = ensurePlaying(state);
  const scores = calculateScores(playingState);
  const winnerIds = winnerId ? [winnerId] : determineWinners(scores);
  const playerWins = playingState.players.player.roundWins + (winnerIds.includes("player") ? 1 : 0);
  const opponentWins = playingState.players.opponent.roundWins + (winnerIds.includes("opponent") ? 1 : 0);
  const matchWinner = playerWins >= 2 ? "player" : opponentWins >= 2 ? "opponent" : undefined;
  const cleaned = moveBoardToDiscard(playingState);
  let nextState: MatchState = {
    ...cleaned,
    phase: matchWinner ? "match-complete" : "playing",
    players: {
      player: {
        ...cleaned.players.player,
        hasPassed: false,
        roundWins: playerWins,
      },
      opponent: {
        ...cleaned.players.opponent,
        hasPassed: false,
        roundWins: opponentWins,
      },
    },
    round: matchWinner
      ? {
          ...cleaned.round,
          phase: "match-complete",
          winnerIds,
        }
      : {
          activePlayerId: winnerIds[0] ?? cleaned.round.activePlayerId,
          number: cleaned.round.number + 1,
          passed: {
            player: false,
            opponent: false,
          },
          phase: "playing",
          winnerIds: [],
        },
    winnerId: matchWinner,
  };

  nextState = appendEvent(nextState, "round.ended", {
    debug: true,
    roundNumber: playingState.round.number,
    scores,
    winnerIds,
  }, true);

  if (matchWinner) {
    nextState = appendEvent(nextState, "match.ended", {
      debug: true,
      winnerId: matchWinner,
    }, true);
  }

  return nextState;
}

function ensurePlaying(state: MatchState): MatchState {
  if (state.phase === "playing") {
    return state;
  }

  return {
    ...state,
    phase: "playing",
    players: {
      player: {
        ...state.players.player,
        hand: {
          ...state.players.player.hand,
          redrawComplete: true,
        },
      },
      opponent: {
        ...state.players.opponent,
        hand: {
          ...state.players.opponent.hand,
          redrawComplete: true,
        },
      },
    },
    round: {
      ...state.round,
      phase: "playing",
    },
  };
}

function addDebugCard(
  state: MatchState,
  options: {
    definitionId: string;
    emitEvent: boolean;
    playerId: PlayerId;
    rowId?: RowId;
    zone: "hand" | "board";
  },
): MatchState {
  const definition = getDefinition(options.definitionId);
  const instance = createCardInstance(state, options.playerId, definition, options.zone, options.rowId);
  let nextState: MatchState = {
    ...state,
    cardDefinitions: {
      ...state.cardDefinitions,
      [definition.id]: definition,
    },
    cards: {
      ...state.cards,
      [instance.id]: instance,
    },
    nextCardInstanceSequence: state.nextCardInstanceSequence + 1,
  };

  if (options.zone === "hand") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [options.playerId]: {
          ...nextState.players[options.playerId],
          hand: {
            ...nextState.players[options.playerId].hand,
            cards: [...nextState.players[options.playerId].hand.cards, instance.id],
          },
        },
      },
    };

    return options.emitEvent
      ? appendEvent(nextState, "card.drawn", {
          cardInstanceId: instance.id,
          debug: true,
          playerId: options.playerId,
          reason: "debug-spawn",
        })
      : nextState;
  }

  const rowId = instance.rowId ?? firstLegalRow(definition);
  nextState = {
    ...nextState,
    board: addCardToBoardRow(nextState.board, options.playerId, rowId, instance.id),
  };

  return options.emitEvent
    ? appendEvent(nextState, "card.played", {
        cardInstanceId: instance.id,
        controllerId: options.playerId,
        debug: true,
        playerId: options.playerId,
        reason: "debug-spawn",
        rowId,
      }, true)
    : nextState;
}

function debugApplyWeather(state: MatchState, rowId: RowId): MatchState {
  const nextState = ensurePlaying({
    ...state,
    board: {
      ...state.board,
      weather: {
        ...state.board.weather,
        [rowId]: true,
      },
    },
  });

  return appendEvent(nextState, "weather.applied", {
    debug: true,
    rowId,
    sourceCardId: weatherCardForRow(rowId),
  }, true);
}

function debugClearWeather(state: MatchState): MatchState {
  const nextState = ensurePlaying({
    ...state,
    board: {
      ...state.board,
      weather: {
        close: false,
        ranged: false,
        siege: false,
      },
    },
  });

  return appendEvent(nextState, "weather.cleared", {
    debug: true,
    rows: [...ROWS],
  }, true);
}

function debugApplyHorn(state: MatchState, playerId: PlayerId, rowId: RowId): MatchState {
  const nextState = ensurePlaying({
    ...state,
    board: {
      ...state.board,
      rows: {
        ...state.board.rows,
        [playerId]: {
          ...state.board.rows[playerId],
          [rowId]: {
            ...state.board.rows[playerId][rowId],
            hornActive: true,
          },
        },
      },
    },
  });

  return appendEvent(nextState, "row.buff.applied", {
    buff: "commanders-horn",
    debug: true,
    playerId,
    rowId,
  }, true);
}

function debugPlaySpecial(state: MatchState, playerId: PlayerId, definitionId: string): MatchState {
  const definition = getDefinition(definitionId);
  const instance = createCardInstance(state, playerId, definition, "hand");
  let nextState: MatchState = {
    ...ensurePlaying(state),
    cardDefinitions: {
      ...state.cardDefinitions,
      [definition.id]: definition,
    },
    cards: {
      ...state.cards,
      [instance.id]: {
        ...instance,
        zone: "discard",
      },
    },
    nextCardInstanceSequence: state.nextCardInstanceSequence + 1,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        discard: {
          cards: [...state.players[playerId].discard.cards, instance.id],
        },
      },
    },
  };

  nextState = appendEvent(nextState, "card.played", {
    cardInstanceId: instance.id,
    debug: true,
    playerId,
    special: true,
  }, true);

  return nextState;
}

function debugPlayAbilityCard(
  state: MatchState,
  playerId: PlayerId,
  definitionId: string,
  rowId: RowId,
  reason?: string,
): MatchState {
  const playingState = ensurePlaying(state);
  const cardInstanceId = getNextDebugCardInstanceId(playingState, playerId);
  let nextState = addDebugCard(playingState, {
    definitionId,
    emitEvent: false,
    playerId,
    rowId,
    zone: "board",
  });

  if (reason === "medic") {
    nextState = appendEvent(nextState, "card.revived", {
      cardInstanceId,
      debug: true,
      playerId,
      rowId,
    }, true);
  }

  return appendEvent(nextState, "card.played", {
    cardInstanceId,
    controllerId: playerId,
    debug: true,
    playerId,
    reason,
    rowId,
  }, true);
}

function destroyBoardCard(
  state: MatchState,
  controllerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
  reason: string,
): MatchState {
  const card = state.cards[cardInstanceId];
  const owner = state.players[card.ownerId];
  const nextState: MatchState = {
    ...state,
    board: removeCardFromBoardRow(state.board, controllerId, rowId, cardInstanceId),
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...card,
        rowId: undefined,
        zone: "discard",
      },
    },
    players: {
      ...state.players,
      [card.ownerId]: {
        ...owner,
        discard: {
          cards: [...owner.discard.cards, cardInstanceId],
        },
      },
    },
  };

  return appendEvent(nextState, "card.destroyed", {
    cardInstanceId,
    controllerId,
    debug: true,
    ownerId: card.ownerId,
    reason,
    rowId,
  }, true);
}

function moveBoardToDiscard(state: MatchState): MatchState {
  const cards = { ...state.cards };
  const playerDiscard = [...state.players.player.discard.cards];
  const opponentDiscard = [...state.players.opponent.discard.cards];

  for (const playerId of ["player", "opponent"] as const) {
    for (const rowId of ROWS) {
      for (const cardInstanceId of state.board.rows[playerId][rowId].cards) {
        const card = cards[cardInstanceId];
        cards[cardInstanceId] = {
          ...card,
          rowId: undefined,
          zone: "discard",
        };

        if (card.ownerId === "player") {
          playerDiscard.push(cardInstanceId);
        } else {
          opponentDiscard.push(cardInstanceId);
        }
      }
    }
  }

  return {
    ...state,
    board: createEmptyBoard(),
    cards,
    players: {
      player: {
        ...state.players.player,
        discard: {
          cards: playerDiscard,
        },
      },
      opponent: {
        ...state.players.opponent,
        discard: {
          cards: opponentDiscard,
        },
      },
    },
  };
}

function createCardInstance(
  state: MatchState,
  playerId: PlayerId,
  definition: CardDefinition,
  zone: "hand" | "board",
  rowId?: RowId,
): CardInstance {
  const resolvedRowId = zone === "board" ? rowId ?? firstLegalRow(definition) : undefined;

  return {
    controllerId: playerId,
    createdSequence: state.nextCardInstanceSequence,
    definitionId: definition.id,
    id: `debug-${playerId}-card-${state.nextCardInstanceSequence.toString().padStart(4, "0")}`,
    ownerId: playerId,
    rowId: resolvedRowId,
    zone,
  };
}

function firstLegalRow(definition: CardDefinition): RowId {
  return definition.rows[0] ?? "close";
}

function getNextDebugCardInstanceId(state: MatchState, playerId: PlayerId): CardInstanceId {
  return `debug-${playerId}-card-${state.nextCardInstanceSequence.toString().padStart(4, "0")}`;
}

function getDefinition(definitionId: string): CardDefinition {
  const definition = CARD_DEFINITIONS_BY_ID[definitionId];

  if (!definition) {
    throw new Error(`Unknown debug card definition: ${definitionId}`);
  }

  return definition;
}

function getDestroyableBoardCards(state: MatchState): Array<{
  basePower: number;
  cardInstanceId: CardInstanceId;
  controllerId: PlayerId;
  rowId: RowId;
}> {
  return (["player", "opponent"] as const).flatMap((controllerId) =>
    ROWS.flatMap((rowId) =>
      state.board.rows[controllerId][rowId].cards
        .filter((cardInstanceId) => {
          const card = state.cards[cardInstanceId];
          const definition = state.cardDefinitions[card.definitionId];
          return definition.type === "unit" && !definition.abilities.includes("hero");
        })
        .map((cardInstanceId) => {
          const definition = state.cardDefinitions[state.cards[cardInstanceId].definitionId];
          return {
            basePower: definition.basePower,
            cardInstanceId,
            controllerId,
            rowId,
          };
        }),
    ),
  );
}

function addCardToBoardRow(
  board: BoardState,
  playerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
): BoardState {
  return {
    ...board,
    rows: {
      ...board.rows,
      [playerId]: {
        ...board.rows[playerId],
        [rowId]: {
          ...board.rows[playerId][rowId],
          cards: [...board.rows[playerId][rowId].cards, cardInstanceId],
        },
      },
    },
  };
}

function removeCardFromBoardRow(
  board: BoardState,
  playerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
): BoardState {
  return {
    ...board,
    rows: {
      ...board.rows,
      [playerId]: {
        ...board.rows[playerId],
        [rowId]: {
          ...board.rows[playerId][rowId],
          cards: board.rows[playerId][rowId].cards.filter((id) => id !== cardInstanceId),
        },
      },
    },
  };
}

function weatherCardForRow(rowId: RowId): string {
  switch (rowId) {
    case "close":
      return "neutral-biting-frost";
    case "ranged":
      return "neutral-impenetrable-fog";
    case "siege":
      return "neutral-torrential-rain";
    default:
      return assertNever(rowId);
  }
}

function determineWinners(scores: Record<PlayerId, number>): PlayerId[] {
  if (scores.player > scores.opponent) {
    return ["player"];
  }

  if (scores.opponent > scores.player) {
    return ["opponent"];
  }

  return [];
}

export function getRepresentativeCardForAbility(abilityId: AbilityId): string {
  return REPRESENTATIVE_ABILITY_CARDS[abilityId];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled debug value: ${JSON.stringify(value)}`);
}
