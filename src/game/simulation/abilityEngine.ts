import { appendEvent } from "./events";
import { calculateScoreBreakdown } from "./scoring";
import type {
  CardDefinition,
  CardInstance,
  CardInstanceId,
  MatchState,
  PlayerId,
  RowId,
} from "./types";

export type ResolveCardPlayOptions = {
  playerId: PlayerId;
  cardInstanceId: CardInstanceId;
  rowId?: RowId;
  targetCardInstanceId?: CardInstanceId;
};

type AbilityResolutionContext = {
  musterGroupsResolved: Set<string>;
  depth: number;
};

export function resolveCardPlay(
  state: MatchState,
  options: ResolveCardPlayOptions,
): MatchState {
  const card = assertHandCard(state, options.playerId, options.cardInstanceId);
  const definition = state.cardDefinitions[card.definitionId];

  if (definition.type === "leader") {
    throw new Error("Leader cards cannot be played from hand.");
  }

  if (definition.type === "special") {
    return resolveSpecialCard(state, options.playerId, card.id, options.rowId, options.targetCardInstanceId);
  }

  if (!options.rowId) {
    throw new Error(`${definition.name} requires a row target.`);
  }

  assertLegalRow(definition, options.rowId);

  const controllerId = definition.abilities.includes("spy")
    ? getOpponentId(options.playerId)
    : options.playerId;
  let nextState = moveHandCardToBoard(state, {
    cardInstanceId: card.id,
    ownerId: options.playerId,
    controllerId,
    rowId: options.rowId,
    reason: definition.abilities.includes("spy") ? "spy" : "play",
  });

  nextState = resolveBoardCardAbilities(nextState, {
    cardInstanceId: card.id,
    playerId: options.playerId,
    rowId: options.rowId,
    targetCardInstanceId: options.targetCardInstanceId,
    context: {
      musterGroupsResolved: new Set(),
      depth: 0,
    },
  });

  return nextState;
}

function resolveSpecialCard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  rowId?: RowId,
  targetCardInstanceId?: CardInstanceId,
): MatchState {
  const definition = getDefinition(state, cardInstanceId);

  if (definition.abilities.includes("decoy")) {
    return resolveDecoy(state, playerId, cardInstanceId, targetCardInstanceId);
  }

  let nextState = discardHandCard(state, playerId, cardInstanceId);
  nextState = appendEvent(
    nextState,
    "card.played",
    {
      playerId,
      cardInstanceId,
      special: true,
    },
    true,
  );

  for (const ability of definition.abilities) {
    switch (ability) {
      case "scorch":
        nextState = resolveScorch(nextState);
        break;
      case "weather":
        nextState = resolveWeather(nextState, definition, rowId);
        break;
      case "clear-weather":
        nextState = resolveClearWeather(nextState);
        break;
      case "commanders-horn":
        nextState = resolveCommandersHorn(nextState, playerId, rowId);
        break;
      case "agile":
      case "decoy":
      case "hero":
      case "medic":
      case "morale-boost":
      case "muster":
      case "spy":
      case "tight-bond":
        break;
      default:
        assertNever(ability);
    }
  }

  return nextState;
}

function resolveBoardCardAbilities(
  state: MatchState,
  options: {
    cardInstanceId: CardInstanceId;
    playerId: PlayerId;
    rowId: RowId;
    targetCardInstanceId?: CardInstanceId;
    context: AbilityResolutionContext;
  },
): MatchState {
  const definition = getDefinition(state, options.cardInstanceId);
  let nextState = state;

  if (options.context.depth > 4) {
    return nextState;
  }

  for (const ability of definition.abilities) {
    switch (ability) {
      case "spy":
        nextState = drawCards(nextState, options.playerId, 2, "spy");
        break;
      case "medic":
        if (options.targetCardInstanceId) {
          nextState = resolveMedic(nextState, options.playerId, options.targetCardInstanceId, {
            ...options.context,
            depth: options.context.depth + 1,
          });
        }
        break;
      case "muster":
        nextState = resolveMuster(nextState, options.playerId, options.cardInstanceId, options.rowId, options.context);
        break;
      case "agile":
      case "hero":
      case "morale-boost":
      case "tight-bond":
      case "clear-weather":
      case "commanders-horn":
      case "decoy":
      case "scorch":
      case "weather":
        break;
      default:
        assertNever(ability);
    }
  }

  return nextState;
}

function resolveMedic(
  state: MatchState,
  playerId: PlayerId,
  targetCardInstanceId: CardInstanceId,
  context: AbilityResolutionContext,
): MatchState {
  const player = state.players[playerId];

  if (!player.discard.cards.includes(targetCardInstanceId)) {
    throw new Error(`${targetCardInstanceId} is not in ${playerId}'s discard pile.`);
  }

  const targetDefinition = getDefinition(state, targetCardInstanceId);

  if (targetDefinition.type !== "unit") {
    throw new Error("Medic can revive only normal unit cards.");
  }

  if (isHeroDefinition(targetDefinition)) {
    throw new Error("Medic cannot revive hero cards.");
  }

  const rowId = targetDefinition.rows[0];

  if (!rowId) {
    throw new Error(`${targetDefinition.name} has no legal revive row.`);
  }

  let nextState: MatchState = {
    ...state,
    cards: {
      ...state.cards,
      [targetCardInstanceId]: {
        ...state.cards[targetCardInstanceId],
        ownerId: playerId,
        controllerId: playerId,
        rowId,
        zone: "board",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        discard: {
          cards: player.discard.cards.filter((id) => id !== targetCardInstanceId),
        },
      },
    },
    board: addCardToBoardRow(state.board, playerId, rowId, targetCardInstanceId),
  };

  nextState = appendEvent(
    nextState,
    "card.revived",
    {
      playerId,
      cardInstanceId: targetCardInstanceId,
      rowId,
    },
    true,
  );
  nextState = appendEvent(
    nextState,
    "card.played",
    {
      playerId,
      cardInstanceId: targetCardInstanceId,
      rowId,
      reason: "medic",
    },
    true,
  );

  return resolveBoardCardAbilities(nextState, {
    cardInstanceId: targetCardInstanceId,
    playerId,
    rowId,
    context,
  });
}

function resolveMuster(
  state: MatchState,
  playerId: PlayerId,
  sourceCardInstanceId: CardInstanceId,
  sourceRowId: RowId,
  context: AbilityResolutionContext,
): MatchState {
  const groupKey = getMusterKey(state, sourceCardInstanceId);

  if (context.musterGroupsResolved.has(groupKey)) {
    return state;
  }

  context.musterGroupsResolved.add(groupKey);

  const player = state.players[playerId];
  const matchingDeckCards = player.deck.cards.filter(
    (cardInstanceId) => getMusterKey(state, cardInstanceId) === groupKey,
  );
  let nextState = state;

  for (const cardInstanceId of matchingDeckCards) {
    const definition = getDefinition(nextState, cardInstanceId);
    const rowId = definition.rows.includes(sourceRowId) ? sourceRowId : definition.rows[0];

    if (!rowId) {
      continue;
    }

    nextState = {
      ...nextState,
      cards: {
        ...nextState.cards,
        [cardInstanceId]: {
          ...nextState.cards[cardInstanceId],
          controllerId: playerId,
          rowId,
          zone: "board",
        },
      },
      players: {
        ...nextState.players,
        [playerId]: {
          ...nextState.players[playerId],
          deck: {
            cards: nextState.players[playerId].deck.cards.filter((id) => id !== cardInstanceId),
          },
        },
      },
      board: addCardToBoardRow(nextState.board, playerId, rowId, cardInstanceId),
    };

    nextState = appendEvent(
      nextState,
      "card.played",
      {
        playerId,
        cardInstanceId,
        rowId,
        reason: "muster",
      },
      true,
    );
  }

  return nextState;
}

function resolveDecoy(
  state: MatchState,
  playerId: PlayerId,
  decoyCardInstanceId: CardInstanceId,
  targetCardInstanceId?: CardInstanceId,
): MatchState {
  if (!targetCardInstanceId) {
    throw new Error("Decoy requires a target card.");
  }

  const targetCard = state.cards[targetCardInstanceId];

  if (!targetCard || targetCard.zone !== "board" || targetCard.controllerId !== playerId || !targetCard.rowId) {
    throw new Error("Decoy target must be a card on the active player's battlefield.");
  }

  const targetDefinition = getDefinition(state, targetCardInstanceId);

  if (isHeroDefinition(targetDefinition)) {
    throw new Error("Decoy cannot target hero cards.");
  }

  const decoyCard = assertHandCard(state, playerId, decoyCardInstanceId);
  const player = state.players[playerId];
  const rowId = targetCard.rowId;
  let nextState: MatchState = {
    ...state,
    cards: {
      ...state.cards,
      [targetCardInstanceId]: {
        ...targetCard,
        ownerId: playerId,
        controllerId: playerId,
        rowId: undefined,
        zone: "hand",
      },
      [decoyCardInstanceId]: {
        ...decoyCard,
        controllerId: playerId,
        rowId,
        zone: "board",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: {
          ...player.hand,
          cards: [
            ...player.hand.cards.filter((id) => id !== decoyCardInstanceId),
            targetCardInstanceId,
          ],
        },
      },
    },
    board: replaceBoardCard(state.board, playerId, rowId, targetCardInstanceId, decoyCardInstanceId),
  };

  nextState = appendEvent(
    nextState,
    "card.played",
    {
      playerId,
      cardInstanceId: decoyCardInstanceId,
      rowId,
      targetCardInstanceId,
      reason: "decoy",
    },
    true,
  );

  return nextState;
}

function resolveScorch(state: MatchState): MatchState {
  const breakdown = calculateScoreBreakdown(state);
  const candidates = (["player", "opponent"] as const).flatMap((playerId) =>
    (["close", "ranged", "siege"] as const).flatMap((rowId) =>
      breakdown[playerId].rows[rowId].cards
        .filter((card) => {
          const definition = state.cardDefinitions[card.definitionId];
          return definition.type === "unit" && !isHeroDefinition(definition) && card.finalPower > 0;
        })
        .map((card) => ({
          playerId,
          rowId,
          cardInstanceId: card.cardInstanceId,
          finalPower: card.finalPower,
        })),
    ),
  );

  if (candidates.length === 0) {
    return state;
  }

  const highestPower = Math.max(...candidates.map((candidate) => candidate.finalPower));
  const destroyedCards = candidates.filter((candidate) => candidate.finalPower === highestPower);

  return destroyedCards.reduce(
    (nextState, candidate) => destroyBoardCard(nextState, candidate.playerId, candidate.rowId, candidate.cardInstanceId),
    state,
  );
}

function resolveWeather(state: MatchState, definition: CardDefinition, rowId?: RowId): MatchState {
  const affectedRows = definition.rows.length > 0 ? definition.rows : rowId ? [rowId] : [];

  if (affectedRows.length === 0) {
    throw new Error(`${definition.name} requires a weather row target.`);
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
      sourceCardId: definition.id,
    });
  }

  return nextState;
}

function resolveClearWeather(state: MatchState): MatchState {
  const nextState: MatchState = {
    ...state,
    board: {
      ...state.board,
      weather: {
        close: false,
        ranged: false,
        siege: false,
      },
    },
  };

  return appendEvent(nextState, "weather.cleared", {
    rows: ["close", "ranged", "siege"],
  });
}

function resolveCommandersHorn(state: MatchState, playerId: PlayerId, rowId?: RowId): MatchState {
  if (!rowId) {
    throw new Error("Commander's Horn requires a row target.");
  }

  if (state.board.rows[playerId][rowId].hornActive) {
    throw new Error(`Commander's Horn is already active on ${playerId} ${rowId}.`);
  }

  const nextState: MatchState = {
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
  };

  return appendEvent(nextState, "row.buff.applied", {
    playerId,
    rowId,
    buff: "commanders-horn",
  });
}

function moveHandCardToBoard(
  state: MatchState,
  options: {
    cardInstanceId: CardInstanceId;
    ownerId: PlayerId;
    controllerId: PlayerId;
    rowId: RowId;
    reason: string;
  },
): MatchState {
  const player = state.players[options.ownerId];
  let nextState: MatchState = {
    ...state,
    cards: {
      ...state.cards,
      [options.cardInstanceId]: {
        ...state.cards[options.cardInstanceId],
        controllerId: options.controllerId,
        rowId: options.rowId,
        zone: "board",
      },
    },
    players: {
      ...state.players,
      [options.ownerId]: {
        ...player,
        hand: {
          ...player.hand,
          cards: player.hand.cards.filter((id) => id !== options.cardInstanceId),
        },
      },
    },
    board: addCardToBoardRow(state.board, options.controllerId, options.rowId, options.cardInstanceId),
  };

  nextState = appendEvent(
    nextState,
    "card.played",
    {
      playerId: options.ownerId,
      controllerId: options.controllerId,
      cardInstanceId: options.cardInstanceId,
      rowId: options.rowId,
      reason: options.reason,
    },
    true,
  );

  return nextState;
}

function discardHandCard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): MatchState {
  const player = state.players[playerId];

  return {
    ...state,
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...state.cards[cardInstanceId],
        rowId: undefined,
        zone: "discard",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: {
          ...player.hand,
          cards: player.hand.cards.filter((id) => id !== cardInstanceId),
        },
        discard: {
          cards: [...player.discard.cards, cardInstanceId],
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

function destroyBoardCard(
  state: MatchState,
  controllerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
): MatchState {
  const card = state.cards[cardInstanceId];
  const owner = state.players[card.ownerId];
  const nextState: MatchState = {
    ...state,
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
    board: removeCardFromBoardRow(state.board, controllerId, rowId, cardInstanceId),
  };

  return appendEvent(
    nextState,
    "card.destroyed",
    {
      controllerId,
      ownerId: card.ownerId,
      rowId,
      cardInstanceId,
      reason: "scorch",
    },
    true,
  );
}

function assertHandCard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): CardInstance {
  const card = state.cards[cardInstanceId];

  if (!card || card.ownerId !== playerId || card.zone !== "hand") {
    throw new Error(`${cardInstanceId} is not a playable card in ${playerId}'s hand.`);
  }

  if (!state.players[playerId].hand.cards.includes(cardInstanceId)) {
    throw new Error(`${cardInstanceId} is missing from ${playerId}'s hand list.`);
  }

  return card;
}

function assertLegalRow(definition: CardDefinition, rowId: RowId) {
  if (!definition.rows.includes(rowId)) {
    throw new Error(`${definition.name} cannot be played on ${rowId}.`);
  }
}

function getDefinition(state: MatchState, cardInstanceId: CardInstanceId): CardDefinition {
  const card = state.cards[cardInstanceId];

  if (!card) {
    throw new Error(`Unknown card instance: ${cardInstanceId}`);
  }

  return state.cardDefinitions[card.definitionId];
}

function isHeroDefinition(definition: CardDefinition): boolean {
  return definition.type === "hero" || definition.abilities.includes("hero");
}

function getMusterKey(state: MatchState, cardInstanceId: CardInstanceId): string {
  const definition = getDefinition(state, cardInstanceId);
  return definition.tags.find((tag) => tag.startsWith("muster:")) ?? definition.name;
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "opponent" : "player";
}

function addCardToBoardRow(
  board: MatchState["board"],
  playerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
): MatchState["board"] {
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
  board: MatchState["board"],
  playerId: PlayerId,
  rowId: RowId,
  cardInstanceId: CardInstanceId,
): MatchState["board"] {
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

function replaceBoardCard(
  board: MatchState["board"],
  playerId: PlayerId,
  rowId: RowId,
  targetCardInstanceId: CardInstanceId,
  replacementCardInstanceId: CardInstanceId,
): MatchState["board"] {
  return {
    ...board,
    rows: {
      ...board.rows,
      [playerId]: {
        ...board.rows[playerId],
        [rowId]: {
          ...board.rows[playerId][rowId],
          cards: board.rows[playerId][rowId].cards.map((id) =>
            id === targetCardInstanceId ? replacementCardInstanceId : id,
          ),
        },
      },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ability: ${JSON.stringify(value)}`);
}
