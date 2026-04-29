import { describe, expect, it } from "vitest";
import { createEmptyMatchState } from "./matchState";
import {
  calculatePlayerScore,
  calculateScoreBreakdown,
  calculateScores,
} from "./scoring";
import type {
  AbilityId,
  CardDefinition,
  CardInstance,
  CardInstanceId,
  CardType,
  MatchState,
  PlayerId,
  RowId,
} from "./types";

describe("scoring", () => {
  it("calculates base unit strength across all rows", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "p-close-4",
      playerId: "player",
      rowId: "close",
      basePower: 4,
    });
    state = addBoardCard(state, {
      id: "p-ranged-6",
      playerId: "player",
      rowId: "ranged",
      basePower: 6,
    });
    state = addBoardCard(state, {
      id: "o-siege-5",
      playerId: "opponent",
      rowId: "siege",
      basePower: 5,
    });

    expect(calculateScores(state)).toEqual({
      player: 10,
      opponent: 5,
    });
    expect(calculatePlayerScore(state, "player")).toBe(10);
  });

  it("applies weather to eligible units in the affected row", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "weathered-unit",
      playerId: "player",
      rowId: "close",
      basePower: 8,
    });
    state = {
      ...state,
      board: {
        ...state.board,
        weather: {
          ...state.board.weather,
          close: true,
        },
      },
    };

    const breakdown = calculateScoreBreakdown(state);

    expect(breakdown.player.rows.close.total).toBe(1);
    expect(breakdown.player.rows.close.cards[0].modifiers).toContainEqual(
      expect.objectContaining({
        source: "weather",
      }),
    );
  });

  it("treats clear weather as no weather modifier", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "clear-weather-unit",
      playerId: "player",
      rowId: "ranged",
      basePower: 7,
    });
    state = {
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

    expect(calculateScoreBreakdown(state).player.rows.ranged.total).toBe(7);
  });

  it("applies Commander's Horn to eligible row units", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "horned-unit-a",
      playerId: "player",
      rowId: "siege",
      basePower: 5,
    });
    state = addBoardCard(state, {
      id: "horned-unit-b",
      playerId: "player",
      rowId: "siege",
      basePower: 3,
    });
    state = {
      ...state,
      board: {
        ...state.board,
        rows: {
          ...state.board.rows,
          player: {
            ...state.board.rows.player,
            siege: {
              ...state.board.rows.player.siege,
              hornActive: true,
            },
          },
        },
      },
    };

    expect(calculateScoreBreakdown(state).player.rows.siege.total).toBe(16);
  });

  it("applies Tight Bond to matching same-row units", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "bond-a",
      playerId: "player",
      rowId: "close",
      name: "Blue Stripes Commando",
      basePower: 4,
      abilities: ["tight-bond"],
      tags: ["bond:blue-stripes"],
    });
    state = addBoardCard(state, {
      id: "bond-b",
      playerId: "player",
      rowId: "close",
      name: "Blue Stripes Commando",
      basePower: 4,
      abilities: ["tight-bond"],
      tags: ["bond:blue-stripes"],
    });

    const breakdown = calculateScoreBreakdown(state);

    expect(breakdown.player.rows.close.total).toBe(16);
    expect(breakdown.player.rows.close.cards[0].modifiers).toContainEqual(
      expect.objectContaining({
        source: "tight-bond",
        multiplier: 2,
      }),
    );
  });

  it("applies Morale Boost to other cards in the same row", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "morale-source",
      playerId: "player",
      rowId: "ranged",
      basePower: 2,
      abilities: ["morale-boost"],
    });
    state = addBoardCard(state, {
      id: "boosted-unit-a",
      playerId: "player",
      rowId: "ranged",
      basePower: 5,
    });
    state = addBoardCard(state, {
      id: "boosted-unit-b",
      playerId: "player",
      rowId: "ranged",
      basePower: 1,
    });

    const cards = calculateScoreBreakdown(state).player.rows.ranged.cards;

    expect(cards.find((card) => card.cardInstanceId === "morale-source")?.finalPower).toBe(2);
    expect(cards.find((card) => card.cardInstanceId === "boosted-unit-a")?.finalPower).toBe(6);
    expect(cards.find((card) => card.cardInstanceId === "boosted-unit-b")?.finalPower).toBe(2);
  });

  it("excludes hero cards from weather and row buffs", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "hero-card",
      playerId: "player",
      rowId: "close",
      type: "hero",
      basePower: 10,
      abilities: ["hero"],
    });
    state = addBoardCard(state, {
      id: "morale-source",
      playerId: "player",
      rowId: "close",
      basePower: 2,
      abilities: ["morale-boost"],
    });
    state = {
      ...state,
      board: {
        ...state.board,
        weather: {
          ...state.board.weather,
          close: true,
        },
        rows: {
          ...state.board.rows,
          player: {
            ...state.board.rows.player,
            close: {
              ...state.board.rows.player.close,
              hornActive: true,
            },
          },
        },
      },
    };

    const hero = calculateScoreBreakdown(state).player.rows.close.cards.find(
      (card) => card.cardInstanceId === "hero-card",
    );

    expect(hero?.finalPower).toBe(10);
    expect(hero?.modifiers).toContainEqual(
      expect.objectContaining({
        source: "hero-immunity",
      }),
    );
  });

  it("calculates stacked modifiers in a stable order", () => {
    let state = createScoringState();
    state = addBoardCard(state, {
      id: "stacked-bond-a",
      playerId: "player",
      rowId: "close",
      name: "Bonded Soldier",
      basePower: 4,
      abilities: ["tight-bond"],
      tags: ["bond:stacked-soldier"],
    });
    state = addBoardCard(state, {
      id: "stacked-bond-b",
      playerId: "player",
      rowId: "close",
      name: "Bonded Soldier",
      basePower: 4,
      abilities: ["tight-bond"],
      tags: ["bond:stacked-soldier"],
    });
    state = addBoardCard(state, {
      id: "stacked-morale",
      playerId: "player",
      rowId: "close",
      basePower: 2,
      abilities: ["morale-boost"],
    });
    state = {
      ...state,
      board: {
        ...state.board,
        weather: {
          ...state.board.weather,
          close: true,
        },
        rows: {
          ...state.board.rows,
          player: {
            ...state.board.rows.player,
            close: {
              ...state.board.rows.player.close,
              hornActive: true,
            },
          },
        },
      },
    };

    const breakdown = calculateScoreBreakdown(state).player.rows.close;

    expect(breakdown.total).toBe(12);
    expect(
      breakdown.cards.find((card) => card.cardInstanceId === "stacked-bond-a")?.modifiers.map(
        (modifier) => modifier.source,
      ),
    ).toEqual(["weather", "tight-bond", "commanders-horn", "morale-boost"]);
  });
});

function createScoringState(): MatchState {
  return createEmptyMatchState({
    id: "scoring-test",
    seed: "scoring-test",
    playerFactionId: "northern-realms",
    opponentFactionId: "monsters",
  });
}

function addBoardCard(
  state: MatchState,
  options: {
    id: CardInstanceId;
    playerId: PlayerId;
    rowId: RowId;
    name?: string;
    type?: CardType;
    basePower: number;
    abilities?: AbilityId[];
    tags?: string[];
  },
): MatchState {
  const definitionId = `${options.id}-definition`;
  const definition: CardDefinition = {
    id: definitionId,
    name: options.name ?? options.id,
    faction: state.players[options.playerId].factionId,
    type: options.type ?? "unit",
    rows: [options.rowId],
    basePower: options.basePower,
    abilities: options.abilities ?? [],
    rarity: "common",
    tags: options.tags ?? [],
    artKey: `test.${options.id}`,
  };
  const instance: CardInstance = {
    id: options.id,
    definitionId,
    ownerId: options.playerId,
    controllerId: options.playerId,
    zone: "board",
    rowId: options.rowId,
    createdSequence: state.nextCardInstanceSequence,
  };

  return {
    ...state,
    nextCardInstanceSequence: state.nextCardInstanceSequence + 1,
    cardDefinitions: {
      ...state.cardDefinitions,
      [definitionId]: definition,
    },
    cards: {
      ...state.cards,
      [options.id]: instance,
    },
    board: {
      ...state.board,
      rows: {
        ...state.board.rows,
        [options.playerId]: {
          ...state.board.rows[options.playerId],
          [options.rowId]: {
            ...state.board.rows[options.playerId][options.rowId],
            cards: [...state.board.rows[options.playerId][options.rowId].cards, options.id],
          },
        },
      },
    },
  };
}
