import { describe, expect, it } from "vitest";
import { STARTER_DECKS } from "../data/starterDecks";
import { createMatchFromFaction } from "./matchFlow";
import { matchReducer } from "./reducer";
import type { CardInstanceId, FactionId, MatchState, PlayerId } from "./types";

describe("match flow", () => {
  it("creates a match from the selected faction and randomly assigns a different opponent faction", () => {
    const state = createMatchFromFaction({
      id: "match-create",
      seed: "create-seed",
      playerFactionId: "northern-realms",
    });

    expect(state.phase).toBe("redraw");
    expect(state.players.player.factionId).toBe("northern-realms");
    expect(state.players.opponent.factionId).not.toBe("northern-realms");
    expect(state.players.player.hand.cards).toHaveLength(10);
    expect(state.players.opponent.hand.cards).toHaveLength(10);
    expect(state.players.player.deck.cards).toHaveLength(getRemainingDeckCount(state, "player"));
    expect(state.players.opponent.deck.cards).toHaveLength(getRemainingDeckCount(state, "opponent"));
  });

  it("creates a match with an explicitly selected opponent faction", () => {
    const state = createMatchFromFaction({
      id: "match-selected-opponent",
      seed: "selected-opponent-seed",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });

    expect(state.players.player.factionId).toBe("northern-realms");
    expect(state.players.opponent.factionId).toBe("monsters");
  });

  it("uses the seed to create deterministic shuffled opening hands", () => {
    const first = createMatchFromFaction({
      id: "match-seeded-a",
      seed: "stable-shuffle-seed",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });
    const second = createMatchFromFaction({
      id: "match-seeded-b",
      seed: "stable-shuffle-seed",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });
    const differentSeed = createMatchFromFaction({
      id: "match-seeded-c",
      seed: "different-shuffle-seed",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });

    expect(first.players.player.hand.cards).toEqual(second.players.player.hand.cards);
    expect(first.players.player.deck.cards).toEqual(second.players.player.deck.cards);
    expect(first.players.player.hand.cards).not.toEqual(differentSeed.players.player.hand.cards);
    expect(getPlayerCardInstanceCount(first, "player")).toBe(
      STARTER_DECKS["northern-realms"].unitIds.length + STARTER_DECKS["northern-realms"].specialIds.length + 1,
    );
  });

  it("uses Scoia'tael first-turn control when either side has that faction", () => {
    const playerScoiatael = createMatchFromFaction({
      id: "match-scoiatael-player",
      seed: "scoiatael-player",
      playerFactionId: "scoiatael",
    });

    expect(playerScoiatael.round.activePlayerId).toBe("player");

    const opponentScoiatael = createMatchFromFaction({
      id: "match-scoiatael-opponent",
      seed: "opponent-is-scoiatael-for-this-seed",
      playerFactionId: "monsters",
    });

    if (opponentScoiatael.players.opponent.factionId === "scoiatael") {
      expect(opponentScoiatael.round.activePlayerId).toBe("opponent");
    }

    const selectedOpponentScoiatael = createMatchFromFaction({
      id: "match-selected-scoiatael-opponent",
      seed: "selected-scoiatael-opponent",
      playerFactionId: "monsters",
      opponentFactionId: "scoiatael",
    });

    expect(selectedOpponentScoiatael.round.activePlayerId).toBe("opponent");
  });

  it("allows each player to redraw up to two opening hand cards", () => {
    let state = createMatchFromFaction({
      id: "match-redraw",
      seed: "redraw-seed",
      playerFactionId: "northern-realms",
    });
    const originalCardId = state.players.player.hand.cards[0];

    state = matchReducer(state, {
      type: "redraw-card",
      playerId: "player",
      cardInstanceId: originalCardId,
    });

    expect(state.players.player.hand.cards).toHaveLength(10);
    expect(state.players.player.hand.cards).not.toContain(originalCardId);
    expect(state.players.player.deck.cards.at(-1)).toBe(originalCardId);
    expect(state.players.player.hand.redrawsRemaining).toBe(1);
  });

  it("rejects redraw attempts after the two-card redraw budget is spent", () => {
    let state = createMatchFromFaction({
      id: "match-redraw-budget",
      seed: "redraw-budget-seed",
      playerFactionId: "northern-realms",
    });

    state = matchReducer(state, {
      type: "redraw-card",
      playerId: "player",
      cardInstanceId: state.players.player.hand.cards[0],
    });
    state = matchReducer(state, {
      type: "redraw-card",
      playerId: "player",
      cardInstanceId: state.players.player.hand.cards[0],
    });

    expect(state.players.player.hand.redrawsRemaining).toBe(0);
    expect(() =>
      matchReducer(state, {
        type: "redraw-card",
        playerId: "player",
        cardInstanceId: state.players.player.hand.cards[0],
      }),
    ).toThrow(/no redraws remaining/);
  });

  it("starts playing after both players finish redraw", () => {
    const state = readyMatch("match-finish-redraw");

    expect(state.phase).toBe("playing");
    expect(state.round.phase).toBe("playing");
  });

  it("plays unit cards to legal rows and alternates turns", () => {
    let state = readyMatch("match-play-card");
    const activePlayerId = state.round.activePlayerId;
    const cardId = findPlayableUnit(state, activePlayerId);
    const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];
    const nextPlayerId = activePlayerId === "player" ? "opponent" : "player";

    state = matchReducer(state, {
      type: "play-card",
      playerId: activePlayerId,
      cardInstanceId: cardId,
      rowId,
    });

    expect(state.players[activePlayerId].hand.cards).not.toContain(cardId);
    expect(state.board.rows[activePlayerId][rowId].cards).toContain(cardId);
    expect(state.cards[cardId]).toMatchObject({
      zone: "board",
      rowId,
    });
    expect(state.round.activePlayerId).toBe(nextPlayerId);
  });

  it("rejects illegal row placement", () => {
    const state = readyMatch("match-illegal-row");
    const activePlayerId = state.round.activePlayerId;
    const cardId = findPlayableUnit(state, activePlayerId);
    const legalRow = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];
    const illegalRow = legalRow === "close" ? "ranged" : "close";

    expect(() =>
      matchReducer(state, {
        type: "play-card",
        playerId: activePlayerId,
        cardInstanceId: cardId,
        rowId: illegalRow,
      }),
    ).toThrow(/cannot be played/);
  });

  it("resolves a round when both players pass", () => {
    let state = readyMatch("match-pass-round");
    const firstPlayer = state.round.activePlayerId;
    state = playFirstUnitForActivePlayer(state);
    const secondPlayer = state.round.activePlayerId;
    state = playFirstUnitForActivePlayer(state);

    state = matchReducer(state, {
      type: "pass-round",
      playerId: state.round.activePlayerId,
    });
    state = matchReducer(state, {
      type: "pass-round",
      playerId: state.round.activePlayerId,
    });

    expect(state.round.number).toBe(2);
    expect(state.phase).toBe("playing");
    expect(state.players[firstPlayer].discard.cards.length).toBeGreaterThanOrEqual(1);
    expect(state.players[secondPlayer].discard.cards.length).toBeGreaterThanOrEqual(1);
    expect(state.eventLog.some((event) => event.type === "round.ended")).toBe(true);
  });

  it("applies Nilfgaard tie wins", () => {
    let state = readyMatch("match-nilfgaard-tie", "nilfgaardian-empire");
    state = matchReducer(state, {
      type: "pass-round",
      playerId: state.round.activePlayerId,
    });
    state = matchReducer(state, {
      type: "pass-round",
      playerId: state.round.activePlayerId,
    });

    expect(state.players.player.roundWins).toBe(1);
    expect(state.players.opponent.roundWins).toBe(0);
  });

  it("draws one extra card for Northern Realms after winning a non-final round", () => {
    let state = readyMatch("match-northern-realms-draw", "northern-realms", "monsters");
    const handSizeBefore = state.players.player.hand.cards.length;
    const deckSizeBefore = state.players.player.deck.cards.length;

    state = playRoundWinningUnitForPlayer(state);

    expect(state.round.number).toBe(2);
    expect(state.players.player.roundWins).toBe(1);
    expect(state.players.player.hand.cards).toHaveLength(handSizeBefore);
    expect(state.players.player.deck.cards).toHaveLength(deckSizeBefore - 1);
    expect(state.eventLog.some((event) =>
      event.type === "card.drawn" &&
      event.payload.playerId === "player" &&
      event.payload.reason === "faction:northern-realms",
    )).toBe(true);
  });

  it("keeps one random Monsters unit on the board between non-final rounds", () => {
    let state = readyMatch("match-monsters-carryover", "monsters", "northern-realms");
    state = forceActivePlayer(state, "player");
    const cardId = findPlayableNormalUnit(state, "player");
    const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];

    state = matchReducer(state, {
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId,
    });
    state = passActivePlayer(state);
    state = passActivePlayer(state);

    expect(state.round.number).toBe(2);
    expect(getBoardCardIds(state, "player")).toEqual([cardId]);
    expect(state.cards[cardId].zone).toBe("board");
  });

  it("moves non-persistent board cards to discard and clears row state between rounds", () => {
    let state = readyMatch("match-round-cleanup", "scoiatael", "northern-realms");
    state = forceActivePlayer(state, "player");
    const cardId = findPlayableNormalUnit(state, "player");
    const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];

    state = matchReducer(state, {
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId,
    });
    state = {
      ...state,
      board: {
        ...state.board,
        weather: {
          ...state.board.weather,
          [rowId]: true,
        },
        rows: {
          ...state.board.rows,
          player: {
            ...state.board.rows.player,
            [rowId]: {
              ...state.board.rows.player[rowId],
              hornActive: true,
            },
          },
        },
      },
    };
    state = passActivePlayer(state);
    state = passActivePlayer(state);

    expect(getBoardCardIds(state, "player")).toEqual([]);
    expect(state.players.player.discard.cards).toContain(cardId);
    expect(state.cards[cardId].zone).toBe("discard");
    expect(state.board.weather).toEqual({
      close: false,
      ranged: false,
      siege: false,
    });
    expect(state.board.rows.player[rowId].hornActive).toBe(false);
  });

  it("can complete a scripted full match through reducer actions", () => {
    let state = readyMatch("match-scripted-full", "scoiatael", "northern-realms");

    state = playRoundWinningUnitForPlayer(state);
    expect(state.phase).toBe("playing");
    state = playRoundWinningUnitForPlayer(state);

    expect(state.phase).toBe("match-complete");
    expect(state.winnerId).toBe("player");
    expect(state.players.player.roundWins).toBe(2);
  });

  it("ends the match after one player wins two rounds", () => {
    let state = readyMatch("match-two-round-win");
    const cardId = findPlayableUnit(state, "player");
    const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];

    state = {
      ...state,
      players: {
        ...state.players,
        player: {
          ...state.players.player,
          roundWins: 1,
        },
      },
      round: {
        ...state.round,
        activePlayerId: "player",
      },
    };

    state = matchReducer(state, {
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId,
    });
    state = matchReducer(state, {
      type: "pass-round",
      playerId: "opponent",
    });
    state = matchReducer(state, {
      type: "pass-round",
      playerId: "player",
    });

    expect(state.phase).toBe("match-complete");
    expect(state.winnerId).toBe("player");
    expect(state.players.player.roundWins).toBe(2);
    expect(state.eventLog.some((event) => event.type === "match.ended")).toBe(true);
  });
});

function readyMatch(
  id: string,
  playerFactionId: FactionId = "northern-realms",
  opponentFactionId?: FactionId,
) {
  let state = createMatchFromFaction({
    id,
    opponentFactionId,
    seed: id,
    playerFactionId,
  });

  state = matchReducer(state, {
    type: "finish-redraw",
    playerId: "player",
  });
  state = matchReducer(state, {
    type: "finish-redraw",
    playerId: "opponent",
  });

  return state;
}

function playRoundWinningUnitForPlayer(state: MatchState): MatchState {
  let nextState = playFirstNormalUnitForPlayer(forceActivePlayer(state, "player"), "player");
  nextState = passActivePlayer(nextState);
  nextState = passActivePlayer(nextState);
  return nextState;
}

function playFirstUnitForActivePlayer(state: MatchState): MatchState {
  const playerId = state.round.activePlayerId;
  const cardId = findPlayableUnit(state, playerId);
  const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];

  return matchReducer(state, {
    type: "play-card",
    playerId,
    cardInstanceId: cardId,
    rowId,
  });
}

function playFirstNormalUnitForPlayer(state: MatchState, playerId: PlayerId): MatchState {
  const cardId = findPlayableNormalUnit(state, playerId);
  const rowId = state.cardDefinitions[state.cards[cardId].definitionId].rows[0];

  return matchReducer(state, {
    type: "play-card",
    playerId,
    cardInstanceId: cardId,
    rowId,
  });
}

function passActivePlayer(state: MatchState): MatchState {
  return matchReducer(state, {
    type: "pass-round",
    playerId: state.round.activePlayerId,
  });
}

function forceActivePlayer(state: MatchState, playerId: PlayerId): MatchState {
  return {
    ...state,
    round: {
      ...state.round,
      activePlayerId: playerId,
    },
  };
}

function findPlayableUnit(state: MatchState, playerId: PlayerId): CardInstanceId {
  const cardId = state.players[playerId].hand.cards.find((candidateId) => {
    const definition = state.cardDefinitions[state.cards[candidateId].definitionId];
    return (definition.type === "unit" || definition.type === "hero") && !definition.abilities.includes("spy");
  });

  if (!cardId) {
    throw new Error(`No playable unit found for ${playerId}.`);
  }

  return cardId;
}

function findPlayableNormalUnit(state: MatchState, playerId: PlayerId): CardInstanceId {
  const cardId = state.players[playerId].hand.cards.find((candidateId) => {
    const definition = state.cardDefinitions[state.cards[candidateId].definitionId];
    return definition.type === "unit" && !definition.abilities.includes("spy");
  });

  if (!cardId) {
    throw new Error(`No playable normal unit found for ${playerId}.`);
  }

  return cardId;
}

function getRemainingDeckCount(state: MatchState, playerId: PlayerId): number {
  const starterDeck = STARTER_DECKS[state.players[playerId].factionId];
  return starterDeck.unitIds.length + starterDeck.specialIds.length - 10;
}

function getBoardCardIds(state: MatchState, playerId: PlayerId): CardInstanceId[] {
  return Object.values(state.board.rows[playerId]).flatMap((row) => row.cards);
}

function getPlayerCardInstanceCount(state: MatchState, playerId: PlayerId): number {
  return [
    ...state.players[playerId].deck.cards,
    ...state.players[playerId].hand.cards,
    ...state.players[playerId].discard.cards,
    ...getBoardCardIds(state, playerId),
    state.players[playerId].leaderCardId,
  ].filter(Boolean).length;
}
