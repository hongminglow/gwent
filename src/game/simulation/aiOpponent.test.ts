import { describe, expect, it } from "vitest";
import {
  chooseAiAction,
  generateLegalActions,
  projectActionScore,
  runAiAutoplay,
} from "./aiOpponent";
import { createMatchFromFaction } from "./matchFlow";
import { matchReducer } from "./reducer";
import type { CardDefinition, MatchState, PlayerId } from "./types";

describe("AI opponent", () => {
  it("generates legal play, pass, and leader actions for the active player", () => {
    const state = readyMatch("ai-legal-actions", "scoiatael");
    const actions = generateLegalActions(state, "player");

    expect(actions.some((action) => action.type === "pass-round")).toBe(true);
    expect(actions.some((action) => action.type === "play-card")).toBe(true);
    expect(actions.some((action) => action.type === "use-leader")).toBe(true);
  });

  it("uses a leader ability through the same reducer contract as other actions", () => {
    let state = readyMatch("ai-use-leader", "scoiatael");
    const handSize = state.players.player.hand.cards.length;
    const deckSize = state.players.player.deck.cards.length;

    state = matchReducer(state, {
      type: "use-leader",
      playerId: "player",
    });

    expect(state.players.player.leaderUsed).toBe(true);
    expect(state.players.player.hand.cards).toHaveLength(handSize + 1);
    expect(state.players.player.deck.cards).toHaveLength(deckSize - 1);
    expect(state.eventLog.some((event) => event.type === "leader.used")).toBe(true);
  });

  it("prioritizes Spy when the active player has a spy in hand", () => {
    const state = findReadyStateWithHandCard("player", (definition) =>
      definition.abilities.includes("spy"),
    );
    const decision = chooseAiAction(state, "player");

    expect(decision?.action.type).toBe("play-card");

    if (decision?.action.type === "play-card") {
      const definition = getActionDefinition(state, decision.action.cardInstanceId);
      expect(definition.abilities).toContain("spy");
    }
  });

  it("does not waste Scorch when it has no positive destruction target", () => {
    const state = findReadyStateWithHandCard("player", (definition) =>
      definition.abilities.includes("scorch"),
    );
    const decision = chooseAiAction(state, "player");

    if (decision?.action.type === "play-card") {
      const definition = getActionDefinition(state, decision.action.cardInstanceId);
      expect(definition.abilities).not.toContain("scorch");
    }
  });

  it("projects score swing for a candidate action without mutating the source state", () => {
    const state = readyMatch("ai-score-projection");
    const activePlayerId = state.round.activePlayerId;
    const action = generateLegalActions(state, activePlayerId).find(
      (candidate) => candidate.type === "play-card",
    );

    if (!action) {
      throw new Error("Expected at least one playable action.");
    }

    const projection = projectActionScore(state, activePlayerId, action);

    expect(projection.state).not.toBe(state);
    expect(state.players[activePlayerId].hand.cards).toContain(action.cardInstanceId);
    expect(Number.isFinite(projection.scoreSwing)).toBe(true);
  });

  it("can autoplay both sides through a complete deterministic match", () => {
    const state = createMatchFromFaction({
      id: "ai-autoplay-full-match",
      seed: "ai-autoplay-full-match",
      playerFactionId: "northern-realms",
    });
    const result = runAiAutoplay(state, {
      controlledPlayers: ["player", "opponent"],
      difficulty: "standard",
      maxActions: 300,
    });

    expect(result.stoppedReason).toBe("match-complete");
    expect(result.state.phase).toBe("match-complete");
    expect(result.decisions.length).toBeGreaterThan(0);
  });
});

function readyMatch(
  id: string,
  playerFactionId: MatchState["players"]["player"]["factionId"] = "northern-realms",
): MatchState {
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

function findReadyStateWithHandCard(
  playerId: PlayerId,
  predicate: (definition: CardDefinition) => boolean,
): MatchState {
  for (let index = 0; index < 250; index += 1) {
    const state = readyMatch(`ai-hand-search-${index}`);
    const forcedActiveState: MatchState = {
      ...state,
      round: {
        ...state.round,
        activePlayerId: playerId,
      },
    };
    const matchingCard = forcedActiveState.players[playerId].hand.cards.find((cardInstanceId) =>
      predicate(getActionDefinition(forcedActiveState, cardInstanceId)),
    );

    if (matchingCard) {
      return forcedActiveState;
    }
  }

  throw new Error(`Could not find matching ${playerId} hand card for AI test.`);
}

function getActionDefinition(state: MatchState, cardInstanceId: string): CardDefinition {
  return state.cardDefinitions[state.cards[cardInstanceId].definitionId];
}
