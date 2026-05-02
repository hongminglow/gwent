import { describe, expect, it } from "vitest";
import { resolveCardPlay } from "./abilityEngine";
import { createEmptyMatchState } from "./matchState";
import { calculateScores } from "./scoring";
import type {
  AbilityId,
  CardDefinition,
  CardInstance,
  CardInstanceId,
  CardType,
  CardZone,
  MatchState,
  PlayerId,
  RowId,
} from "./types";

describe("ability engine", () => {
  it("plays Spy on the opponent side and draws two cards for the owner", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "spy",
      ownerId: "player",
      zone: "hand",
      rowId: "close",
      basePower: 4,
      abilities: ["spy"],
    });
    state = addCard(state, {
      id: "deck-a",
      ownerId: "player",
      zone: "deck",
      rowId: "close",
      basePower: 2,
    });
    state = addCard(state, {
      id: "deck-b",
      ownerId: "player",
      zone: "deck",
      rowId: "ranged",
      basePower: 3,
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "spy",
      rowId: "close",
    });

    expect(state.board.rows.opponent.close.cards).toContain("spy");
    expect(state.cards.spy.controllerId).toBe("opponent");
    expect(state.players.player.hand.cards).toEqual(["deck-a", "deck-b"]);
    expect(calculateScores(state)).toEqual({
      player: 0,
      opponent: 4,
    });
  });

  it("plays an opponent non-Spy unit on the opponent side", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "opponent-unit",
      ownerId: "opponent",
      zone: "hand",
      rowId: "close",
      basePower: 5,
    });

    state = resolveCardPlay(state, {
      playerId: "opponent",
      cardInstanceId: "opponent-unit",
      rowId: "close",
    });

    expect(state.board.rows.opponent.close.cards).toContain("opponent-unit");
    expect(state.board.rows.player.close.cards).not.toContain("opponent-unit");
    expect(state.cards["opponent-unit"].controllerId).toBe("opponent");
  });

  it("revives a valid unit with Medic and emits revive events", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "medic",
      ownerId: "player",
      zone: "hand",
      rowId: "ranged",
      basePower: 5,
      abilities: ["medic"],
    });
    state = addCard(state, {
      id: "fallen-unit",
      ownerId: "player",
      zone: "discard",
      rowId: "close",
      basePower: 6,
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "medic",
      rowId: "ranged",
      targetCardInstanceId: "fallen-unit",
    });

    expect(state.board.rows.player.ranged.cards).toContain("medic");
    expect(state.board.rows.player.close.cards).toContain("fallen-unit");
    expect(state.players.player.discard.cards).not.toContain("fallen-unit");
    expect(state.eventLog.some((event) => event.type === "card.revived")).toBe(true);
  });

  it("revives Spy units onto the opponent row and draws for the medic owner", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "medic",
      ownerId: "player",
      zone: "hand",
      rowId: "ranged",
      basePower: 5,
      abilities: ["medic"],
    });
    state = addCard(state, {
      id: "fallen-spy",
      ownerId: "player",
      zone: "discard",
      rowId: "close",
      basePower: 4,
      abilities: ["spy"],
    });
    state = addCard(state, {
      id: "draw-one",
      ownerId: "player",
      zone: "deck",
      rowId: "close",
      basePower: 1,
    });
    state = addCard(state, {
      id: "draw-two",
      ownerId: "player",
      zone: "deck",
      rowId: "close",
      basePower: 1,
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "medic",
      rowId: "ranged",
      targetCardInstanceId: "fallen-spy",
    });

    expect(state.board.rows.opponent.close.cards).toContain("fallen-spy");
    expect(state.board.rows.player.close.cards).not.toContain("fallen-spy");
    expect(state.cards["fallen-spy"].controllerId).toBe("opponent");
    expect(state.players.player.hand.cards).toEqual(expect.arrayContaining(["draw-one", "draw-two"]));
    expect(calculateScores(state)).toEqual({
      player: 5,
      opponent: 4,
    });
  });

  it("rejects Medic targets that are heroes or special cards", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "medic",
      ownerId: "player",
      zone: "hand",
      rowId: "ranged",
      basePower: 5,
      abilities: ["medic"],
    });
    state = addCard(state, {
      id: "hero-target",
      ownerId: "player",
      zone: "discard",
      rowId: "close",
      type: "hero",
      basePower: 10,
      abilities: ["hero"],
    });

    expect(() =>
      resolveCardPlay(state, {
        playerId: "player",
        cardInstanceId: "medic",
        rowId: "ranged",
        targetCardInstanceId: "hero-target",
      }),
    ).toThrow(/normal unit/);
  });

  it("pulls matching Muster cards from deck only", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "muster-source",
      ownerId: "player",
      zone: "hand",
      rowId: "close",
      basePower: 3,
      abilities: ["muster"],
      tags: ["muster:pack"],
    });
    state = addCard(state, {
      id: "muster-deck-a",
      ownerId: "player",
      zone: "deck",
      rowId: "close",
      basePower: 3,
      abilities: ["muster"],
      tags: ["muster:pack"],
    });
    state = addCard(state, {
      id: "muster-hand-b",
      ownerId: "player",
      zone: "hand",
      rowId: "close",
      basePower: 3,
      abilities: ["muster"],
      tags: ["muster:pack"],
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "muster-source",
      rowId: "close",
    });

    expect(state.board.rows.player.close.cards).toEqual(["muster-source", "muster-deck-a"]);
    expect(state.players.player.deck.cards).not.toContain("muster-deck-a");
    expect(state.players.player.hand.cards).toContain("muster-hand-b");
  });

  it("applies weather cards and Clear Weather", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "frost",
      ownerId: "player",
      zone: "hand",
      type: "special",
      rowId: "close",
      basePower: 0,
      abilities: ["weather"],
    });
    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "frost",
      rowId: "close",
    });

    expect(state.board.weather.close).toBe(true);

    state = addCard(state, {
      id: "clear-weather",
      ownerId: "player",
      zone: "hand",
      type: "special",
      basePower: 0,
      abilities: ["clear-weather"],
    });
    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "clear-weather",
    });

    expect(state.board.weather).toEqual({
      close: false,
      ranged: false,
      siege: false,
    });
  });

  it("applies Commander's Horn to the selected row", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "horn",
      ownerId: "player",
      zone: "hand",
      type: "special",
      basePower: 0,
      abilities: ["commanders-horn"],
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "horn",
      rowId: "siege",
    });

    expect(state.board.rows.player.siege.hornActive).toBe(true);
    expect(state.eventLog.some((event) => event.type === "row.buff.applied")).toBe(true);
  });

  it("destroys the strongest tied non-hero cards with Scorch", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "scorch",
      ownerId: "player",
      zone: "hand",
      type: "special",
      basePower: 0,
      abilities: ["scorch"],
    });
    state = addCard(state, {
      id: "target-a",
      ownerId: "player",
      zone: "board",
      rowId: "close",
      basePower: 8,
    });
    state = addCard(state, {
      id: "target-b",
      ownerId: "opponent",
      zone: "board",
      rowId: "ranged",
      basePower: 8,
    });
    state = addCard(state, {
      id: "hero-safe",
      ownerId: "opponent",
      zone: "board",
      rowId: "siege",
      type: "hero",
      basePower: 10,
      abilities: ["hero"],
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "scorch",
    });

    expect(state.cards["target-a"].zone).toBe("discard");
    expect(state.cards["target-b"].zone).toBe("discard");
    expect(state.cards["hero-safe"].zone).toBe("board");
    expect(state.eventLog.filter((event) => event.type === "card.destroyed")).toHaveLength(2);
  });

  it("swaps Decoy with a non-hero battlefield card", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "decoy",
      ownerId: "player",
      zone: "hand",
      type: "special",
      basePower: 0,
      abilities: ["decoy"],
    });
    state = addCard(state, {
      id: "board-unit",
      ownerId: "player",
      zone: "board",
      rowId: "ranged",
      basePower: 5,
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "decoy",
      targetCardInstanceId: "board-unit",
    });

    expect(state.players.player.hand.cards).toContain("board-unit");
    expect(state.cards["board-unit"].zone).toBe("hand");
    expect(state.cards.decoy.zone).toBe("board");
    expect(state.board.rows.player.ranged.cards).toEqual(["decoy"]);
  });

  it("rejects Decoy on hero cards", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "decoy",
      ownerId: "player",
      zone: "hand",
      type: "special",
      basePower: 0,
      abilities: ["decoy"],
    });
    state = addCard(state, {
      id: "hero",
      ownerId: "player",
      zone: "board",
      rowId: "close",
      type: "hero",
      basePower: 10,
      abilities: ["hero"],
    });

    expect(() =>
      resolveCardPlay(state, {
        playerId: "player",
        cardInstanceId: "decoy",
        targetCardInstanceId: "hero",
      }),
    ).toThrow(/hero/);
  });

  it("allows Agile units to choose Close Combat or Ranged rows", () => {
    let state = createAbilityState();
    state = addCard(state, {
      id: "agile",
      ownerId: "player",
      zone: "hand",
      rowId: "close",
      rows: ["close", "ranged"],
      basePower: 5,
      abilities: ["agile"],
    });

    state = resolveCardPlay(state, {
      playerId: "player",
      cardInstanceId: "agile",
      rowId: "ranged",
    });

    expect(state.board.rows.player.ranged.cards).toContain("agile");
  });
});

function createAbilityState(): MatchState {
  return {
    ...createEmptyMatchState({
      id: "ability-test",
      seed: "ability-test",
      playerFactionId: "northern-realms",
      opponentFactionId: "monsters",
      activePlayerId: "player",
    }),
    phase: "playing",
    round: {
      number: 1,
      phase: "playing",
      activePlayerId: "player",
      passed: {
        player: false,
        opponent: false,
      },
      winnerIds: [],
    },
    eventLog: [],
    nextEventSequence: 1,
  };
}

function addCard(
  state: MatchState,
  options: {
    id: CardInstanceId;
    ownerId: PlayerId;
    zone: CardZone;
    rowId?: RowId;
    rows?: RowId[];
    type?: CardType;
    basePower: number;
    abilities?: AbilityId[];
    tags?: string[];
  },
): MatchState {
  const definitionId = `${options.id}-definition`;
  const definition: CardDefinition = {
    id: definitionId,
    name: options.id,
    faction: state.players[options.ownerId].factionId,
    type: options.type ?? "unit",
    rows: options.rows ?? (options.rowId ? [options.rowId] : []),
    basePower: options.basePower,
    abilities: options.abilities ?? [],
    rarity: "common",
    tags: options.tags ?? [],
    artKey: `test.${options.id}`,
  };
  const instance: CardInstance = {
    id: options.id,
    definitionId,
    ownerId: options.ownerId,
    controllerId: options.ownerId,
    zone: options.zone,
    rowId: options.zone === "board" ? options.rowId : undefined,
    createdSequence: state.nextCardInstanceSequence,
  };
  let nextState: MatchState = {
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
  };

  if (options.zone === "hand") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [options.ownerId]: {
          ...nextState.players[options.ownerId],
          hand: {
            ...nextState.players[options.ownerId].hand,
            cards: [...nextState.players[options.ownerId].hand.cards, options.id],
          },
        },
      },
    };
  }

  if (options.zone === "deck") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [options.ownerId]: {
          ...nextState.players[options.ownerId],
          deck: {
            cards: [...nextState.players[options.ownerId].deck.cards, options.id],
          },
        },
      },
    };
  }

  if (options.zone === "discard") {
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [options.ownerId]: {
          ...nextState.players[options.ownerId],
          discard: {
            cards: [...nextState.players[options.ownerId].discard.cards, options.id],
          },
        },
      },
    };
  }

  if (options.zone === "board" && options.rowId) {
    nextState = {
      ...nextState,
      board: {
        ...nextState.board,
        rows: {
          ...nextState.board.rows,
          [options.ownerId]: {
            ...nextState.board.rows[options.ownerId],
            [options.rowId]: {
              ...nextState.board.rows[options.ownerId][options.rowId],
              cards: [...nextState.board.rows[options.ownerId][options.rowId].cards, options.id],
            },
          },
        },
      },
    };
  }

  return nextState;
}
