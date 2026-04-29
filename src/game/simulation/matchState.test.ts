import { describe, expect, it } from "vitest";
import { createMatchFromFaction } from "./matchFlow";
import { matchReducer } from "./reducer";
import { restoreMatchState, serializeMatchState } from "./serialization";
import { createEmptyMatchState } from "./matchState";

describe("match state", () => {
  it("creates a serializable empty match shell", () => {
    const state = createEmptyMatchState({
      id: "match-1",
      seed: "phase-3",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });

    expect(state.id).toBe("match-1");
    expect(state.players.player.factionId).toBe("northern-realms");
    expect(state.players.opponent.factionId).toBe("monsters");
    expect(state.board.rows.player.close.cards).toEqual([]);
    expect(state.board.weather).toEqual({
      close: false,
      ranged: false,
      siege: false,
    });
    expect(state.eventLog[0]).toMatchObject({
      id: "event-000001",
      type: "match.created",
    });
  });

  it("round trips through JSON without losing state", () => {
    const state = createEmptyMatchState({
      id: "match-serialize",
      seed: "restore-seed",
      playerFactionId: "nilfgaardian-empire",
      opponentFactionId: "scoiatael",
    });

    const restored = restoreMatchState(serializeMatchState(state));

    expect(restored).toEqual(state);
  });

  it("logs pass events while keeping previous state immutable", () => {
    let state = createMatchFromFaction({
      id: "match-pass",
      seed: "pass-seed",
      playerFactionId: "northern-realms",
    });
    state = matchReducer(state, {
      type: "finish-redraw",
      playerId: "player",
    });
    state = matchReducer(state, {
      type: "finish-redraw",
      playerId: "opponent",
    });
    const activePlayerId = state.round.activePlayerId;
    const otherPlayerId = activePlayerId === "player" ? "opponent" : "player";

    const nextState = matchReducer(state, {
      type: "pass-round",
      playerId: activePlayerId,
    });

    expect(state.players[activePlayerId].hasPassed).toBe(false);
    expect(nextState.players[activePlayerId].hasPassed).toBe(true);
    expect(nextState.round.passed[activePlayerId]).toBe(true);
    expect(nextState.round.activePlayerId).toBe(otherPlayerId);
    expect(nextState.eventLog.at(-1)).toMatchObject({
      type: "turn.changed",
      payload: {
        activePlayerId: otherPlayerId,
      },
    });
    expect(nextState.eventLog.at(-2)).toMatchObject({
      type: "player.passed",
      payload: {
        playerId: activePlayerId,
      },
    });
  });

  it("can clear renderer-facing events after they are consumed", () => {
    const state = createEmptyMatchState({
      id: "match-clear-events",
      seed: "clear-events",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });

    const nextState = matchReducer(state, {
      type: "clear-event-log",
    });

    expect(nextState.eventLog).toEqual([]);
    expect(nextState.nextEventSequence).toBe(state.nextEventSequence);
  });
});
