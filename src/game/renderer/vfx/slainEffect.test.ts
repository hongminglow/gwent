import { describe, expect, it } from "vitest";
import { createEmptyMatchState } from "../../simulation/matchState";
import type { CardDefinition, CardInstance, GameEvent, MatchState } from "../../simulation/types";
import {
  createSlainAnimationContract,
  createSlainCardEffect,
  getSlainAnimationDuration,
} from "./slainEffect";

describe("slain effect", () => {
  it("creates a renderer contract from scorch destruction events", () => {
    const state = createStateWithDestroyedCard(commonCard);
    const contract = createSlainAnimationContract(createDestroyedEvent("scorch"), state);

    expect(contract).toMatchObject({
      cardInstanceId: "target-card",
      controllerId: "player",
      major: false,
      ownerId: "player",
      reason: "scorch",
      rowId: "close",
      variant: "ember",
    });
    expect(contract?.durationSeconds).toBe(getSlainAnimationDuration(commonCard));
  });

  it("uses slow-motion timing for major destroyed cards and a reduced-motion fallback", () => {
    expect(getSlainAnimationDuration(majorCard)).toBeGreaterThan(getSlainAnimationDuration(commonCard));
    expect(getSlainAnimationDuration(majorCard, { reducedMotion: true })).toBe(0.18);
  });

  it("keeps future destroy reasons on the same animation contract", () => {
    const state = createStateWithDestroyedCard(commonCard);
    const contract = createSlainAnimationContract(createDestroyedEvent("row-scorch"), state);

    expect(contract).toMatchObject({
      cardInstanceId: "target-card",
      reason: "row-scorch",
      variant: "magic",
    });
  });

  it("builds disposable slash, cut, spark, and fragment nodes", () => {
    const state = createStateWithDestroyedCard(commonCard);
    const contract = createSlainAnimationContract(createDestroyedEvent("scorch"), state);

    if (!contract) {
      throw new Error("Missing slain contract.");
    }

    const effect = createSlainCardEffect(contract);
    effect.update(0.5);

    expect(effect.root.name).toBe("SlainSliceVfx:target-card");
    expect(effect.root.children.length).toBeGreaterThan(4);

    effect.dispose();
    expect(effect.root.parent).toBeNull();
  });
});

const commonCard: CardDefinition = {
  id: "common-target",
  abilities: [],
  artKey: "cards.common-target",
  basePower: 4,
  faction: "northern-realms",
  name: "Common Target",
  rarity: "common",
  rows: ["close"],
  tags: [],
  type: "unit",
};

const majorCard: CardDefinition = {
  ...commonCard,
  id: "major-target",
  basePower: 10,
  name: "Major Target",
  rarity: "legendary",
};

function createStateWithDestroyedCard(definition: CardDefinition): MatchState {
  const card: CardInstance = {
    id: "target-card",
    controllerId: "player",
    createdSequence: 1,
    definitionId: definition.id,
    ownerId: "player",
    rowId: "close",
    zone: "discard",
  };
  const state = createEmptyMatchState({
    id: "slain-test",
    seed: "slain-test",
    playerFactionId: "northern-realms",
    opponentFactionId: "monsters",
    cardDefinitions: [definition],
  });

  return {
    ...state,
    phase: "playing",
    cards: {
      [card.id]: card,
    },
  };
}

function createDestroyedEvent(reason: string): GameEvent {
  return {
    id: `destroyed:${reason}`,
    blocking: true,
    payload: {
      cardInstanceId: "target-card",
      controllerId: "player",
      ownerId: "player",
      reason,
      rowId: "close",
    },
    sequence: 2,
    type: "card.destroyed",
  };
}
