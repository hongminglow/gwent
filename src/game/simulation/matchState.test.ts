import { describe, expect, it } from "vitest";
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
    const state = createEmptyMatchState({
      id: "match-pass",
      seed: "pass-seed",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
    });

    const nextState = matchReducer(state, {
      type: "pass-round",
      playerId: "player",
    });

    expect(state.players.player.hasPassed).toBe(false);
    expect(nextState.players.player.hasPassed).toBe(true);
    expect(nextState.round.passed.player).toBe(true);
    expect(nextState.round.activePlayerId).toBe("opponent");
    expect(nextState.eventLog.at(-1)).toMatchObject({
      id: "event-000002",
      type: "player.passed",
      payload: {
        playerId: "player",
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
