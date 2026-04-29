import { describe, expect, it } from "vitest";
import { createMatchFromFaction } from "./matchFlow";
import { matchReducer } from "./reducer";
import type { CardInstanceId, MatchState, PlayerId } from "./types";

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
    expect(state.players.player.deck.cards).toHaveLength(19);
    expect(state.players.opponent.deck.cards).toHaveLength(19);
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

function readyMatch(id: string, playerFactionId: MatchState["players"]["player"]["factionId"] = "northern-realms") {
  let state = createMatchFromFaction({
    id,
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
