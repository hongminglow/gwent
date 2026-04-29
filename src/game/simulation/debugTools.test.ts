import { describe, expect, it } from "vitest";
import { DEBUG_HAND_PRESETS } from "./debugTools";
import { createMatchFromFaction } from "./matchFlow";
import { matchReducer } from "./reducer";
import type { MatchState, PlayerId } from "./types";

describe("debug tools", () => {
  it("forces deterministic hands and moves the match into play", () => {
    const forcedIds = ["neutral-scorch", "nr-vernon-roche", "nr-blue-stripes-commando"];
    const state = matchReducer(createDebugMatch(), {
      type: "debug-force-hand",
      definitionIds: forcedIds,
      playerId: "player",
    });

    expect(state.phase).toBe("playing");
    expect(state.players.player.hand.redrawComplete).toBe(true);
    expect(getHandDefinitionIds(state, "player")).toEqual(forcedIds);
    expect(state.eventLog.at(-1)?.payload).toMatchObject({
      playerId: "player",
      reason: "debug-force-hand",
    });
  });

  it("spawns selected cards to hand and board", () => {
    let state = createDebugMatch();
    state = matchReducer(state, {
      type: "debug-spawn-card",
      definitionId: "neutral-scorch",
      playerId: "player",
      zone: "hand",
    });
    const handCardId = state.players.player.hand.cards.at(-1);

    state = matchReducer(state, {
      type: "debug-spawn-card",
      definitionId: "nr-blue-stripes-commando",
      playerId: "player",
      rowId: "close",
      zone: "board",
    });
    const boardCardId = state.board.rows.player.close.cards.at(-1);

    expect(handCardId).toBeDefined();
    expect(state.cards[handCardId ?? ""]?.definitionId).toBe("neutral-scorch");
    expect(boardCardId).toBeDefined();
    expect(state.cards[boardCardId ?? ""]?.definitionId).toBe("nr-blue-stripes-commando");
    expect(state.cards[boardCardId ?? ""]?.zone).toBe("board");
  });

  it("triggers ability shortcuts without requiring a hand card", () => {
    let state = matchReducer(createDebugMatch(), {
      type: "debug-trigger-ability",
      abilityId: "weather",
      playerId: "player",
      rowId: "close",
    });
    expect(state.board.weather.close).toBe(true);

    state = matchReducer(state, {
      type: "debug-trigger-ability",
      abilityId: "commanders-horn",
      playerId: "player",
      rowId: "siege",
    });
    expect(state.board.rows.player.siege.hornActive).toBe(true);

    state = matchReducer(state, {
      type: "debug-trigger-ability",
      abilityId: "clear-weather",
      playerId: "player",
    });
    expect(state.board.weather).toEqual({
      close: false,
      ranged: false,
      siege: false,
    });
  });

  it("runs scorch and slain destruction scenarios", () => {
    let state = matchReducer(createDebugMatch(), {
      type: "debug-trigger-scorch",
      playerId: "opponent",
      rowId: "ranged",
    });
    expect(state.eventLog.some((event) => event.type === "card.destroyed")).toBe(true);
    expect(Object.values(state.cards).some((card) => card.zone === "discard")).toBe(true);

    state = matchReducer(state, {
      type: "debug-trigger-slain",
      playerId: "player",
      rowId: "close",
    });
    expect(state.eventLog.at(-1)).toMatchObject({
      type: "card.destroyed",
      payload: {
        reason: "debug-slain",
      },
    });
  });

  it("skips directly to round results", () => {
    const state = matchReducer(createDebugMatch(), {
      type: "debug-skip-round",
      winnerId: "player",
    });

    expect(state.round.number).toBe(2);
    expect(state.players.player.roundWins).toBe(1);
    expect(state.eventLog.at(-1)?.type).toBe("round.ended");
  });

  it("keeps the preset hands aligned with valid card definitions", () => {
    let state = createDebugMatch();
    state = matchReducer(state, {
      type: "debug-force-hand",
      definitionIds: DEBUG_HAND_PRESETS.opponent,
      playerId: "opponent",
    });

    expect(getHandDefinitionIds(state, "opponent")).toEqual(DEBUG_HAND_PRESETS.opponent);
  });
});

function createDebugMatch(): MatchState {
  return createMatchFromFaction({
    id: "debug-tools-test",
    opponentFactionId: "nilfgaardian-empire",
    playerFactionId: "northern-realms",
    seed: "debug-tools-test",
  });
}

function getHandDefinitionIds(state: MatchState, playerId: PlayerId): string[] {
  return state.players[playerId].hand.cards.map((cardInstanceId) => state.cards[cardInstanceId].definitionId);
}
