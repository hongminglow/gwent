import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createEmptyMatchState } from "../../simulation/matchState";
import type {
  CardDefinition,
  CardInstance,
  CardInstanceId,
  CardType,
  GameEvent,
  MatchState,
  PlayerId,
} from "../../simulation/types";
import type { BoardAnchors } from "../boardScene";
import {
  createAbilityEventEffect,
  getWeatherEffectKind,
  type AbilityEventEffectContext,
} from "./abilityEventEffects";

describe("ability event effects", () => {
  it("maps weather rows to frost, fog, and rain effects", () => {
    expect(getWeatherEffectKind("close", "neutral-biting-frost")).toBe("weather-frost");
    expect(getWeatherEffectKind("ranged", "neutral-impenetrable-fog")).toBe("weather-fog");
    expect(getWeatherEffectKind("siege", "neutral-torrential-rain")).toBe("weather-rain");
  });

  it("creates row-level weather, clear weather, and Horn effects", () => {
    const context = createContext();
    const state = createState([]);
    const weather = createAbilityEventEffect(event("weather.applied", {
      rowId: "close",
      sourceCardId: "neutral-biting-frost",
    }), state, context);
    const clear = createAbilityEventEffect(event("weather.cleared", {
      rows: ["close", "ranged", "siege"],
    }), state, context);
    const horn = createAbilityEventEffect(event("row.buff.applied", {
      buff: "commanders-horn",
      playerId: "player",
      rowId: "ranged",
    }), state, context);

    expect(weather?.kind).toBe("weather-frost");
    expect(clear?.kind).toBe("clear-weather");
    expect(horn?.kind).toBe("commanders-horn");
    weather?.update(0.5);
    clear?.update(0.5);
    horn?.update(0.5);
    weather?.dispose();
    clear?.dispose();
    horn?.dispose();
    expect(context.boardRoot.children.filter((child) => child.name.startsWith("AbilityVfx:"))).toHaveLength(0);
  });

  it("creates card-level spy, muster, medic, hero, tight-bond, and morale effects", () => {
    const definitions = [
      definition("spy-card", "unit", ["spy"]),
      definition("muster-card", "unit", ["muster"]),
      definition("medic-card", "unit", []),
      definition("hero-card", "hero", ["hero"], 10),
      definition("tight-card", "unit", ["tight-bond"]),
      definition("morale-card", "unit", ["morale-boost"]),
    ];
    const state = createState(definitions);
    const context = createContext(["spy", "muster", "medic", "hero", "tight", "morale"]);

    expect(createAbilityEventEffect(cardPlayed("spy", "spy-card", { reason: "spy" }), state, context)?.kind).toBe("spy-shadow");
    expect(createAbilityEventEffect(cardPlayed("muster", "muster-card", { reason: "muster" }), state, context)?.kind).toBe("muster-chain");
    expect(createAbilityEventEffect(cardPlayed("medic", "medic-card", { reason: "medic" }), state, context)?.kind).toBe("medic-revive");
    expect(createAbilityEventEffect(cardPlayed("hero", "hero-card"), state, context)?.kind).toBe("hero-glint");
    expect(createAbilityEventEffect(cardPlayed("tight", "tight-card"), state, context)?.kind).toBe("tight-bond");
    expect(createAbilityEventEffect(cardPlayed("morale", "morale-card"), state, context)?.kind).toBe("morale-shimmer");
  });

  it("creates leader and match win presentation effects without round cleanup VFX", () => {
    const leader = definition("leader-card", "leader", ["weather"], 0, "northern-realms");
    const state = createState([leader]);
    const context = createContext(["leader"]);
    const leaderEffect = createAbilityEventEffect(event("leader.used", {
      leaderCardInstanceId: "leader",
      playerId: "player",
      rowId: "close",
    }), state, context);
    const roundWinEffect = createAbilityEventEffect(event("round.ended", {
      winnerIds: ["player"],
    }), state, context);
    const matchWinEffect = createAbilityEventEffect(event("match.ended", {
      winnerId: "player",
    }), state, context);

    expect(leaderEffect?.kind).toBe("leader-burst");
    expect(roundWinEffect).toBeUndefined();
    expect(matchWinEffect?.kind).toBe("match-win");
    leaderEffect?.update(0.5);
    matchWinEffect?.update(0.5);
    leaderEffect?.dispose();
    matchWinEffect?.dispose();
  });
});

function createState(definitions: CardDefinition[]): MatchState {
  const state = createEmptyMatchState({
    id: "ability-vfx-test",
    seed: "ability-vfx-test",
    playerFactionId: "northern-realms",
    opponentFactionId: "monsters",
    cardDefinitions: definitions,
  });
  const cards = Object.fromEntries(
    definitions.map((cardDefinition) => [
      cardDefinition.id.replace("-card", ""),
      cardInstance(cardDefinition.id.replace("-card", ""), cardDefinition.id),
    ]),
  );

  return {
    ...state,
    phase: "playing",
    cards,
  };
}

function definition(
  id: string,
  type: CardType,
  abilities: CardDefinition["abilities"],
  basePower = 4,
  faction: CardDefinition["faction"] = "neutral",
): CardDefinition {
  return {
    id,
    abilities,
    artKey: `cards.${id}`,
    basePower,
    faction,
    name: id,
    rarity: type === "hero" || type === "leader" ? "legendary" : "common",
    rows: type === "leader" ? [] : ["close", "ranged"],
    tags: [],
    type,
  };
}

function cardInstance(id: CardInstanceId, definitionId: string): CardInstance {
  return {
    id,
    controllerId: "player",
    createdSequence: 1,
    definitionId,
    ownerId: "player",
    rowId: "close",
    zone: definitionId.includes("leader") ? "leader" : "board",
  };
}

function createContext(cardIds: CardInstanceId[] = []): AbilityEventEffectContext {
  const boardRoot = new THREE.Group();
  const anchors = createAnchors();
  const cardRoots = new Map<CardInstanceId, THREE.Group>();

  for (const playerId of ["player", "opponent"] as const) {
    for (const rowId of ["close", "ranged", "siege"] as const) {
      boardRoot.add(anchors.rowZones[playerId][rowId]);
    }
  }

  for (const cardId of cardIds) {
    const cardRoot = new THREE.Group();
    cardRoot.name = `Card:${cardId}`;
    cardRoots.set(cardId, cardRoot);
  }

  return {
    anchors,
    boardRoot,
    getCardRoot(cardInstanceId) {
      return cardRoots.get(cardInstanceId);
    },
  };
}

function createAnchors(): BoardAnchors {
  const rowZones = {
    player: {
      close: rowAnchor(1.75),
      ranged: rowAnchor(3.55),
      siege: rowAnchor(5.35),
    },
    opponent: {
      close: rowAnchor(-1.75),
      ranged: rowAnchor(-3.55),
      siege: rowAnchor(-5.35),
    },
  };

  return {
    rowZones,
    scorePlates: {
      player: new THREE.Group(),
      opponent: new THREE.Group(),
    },
    piles: {
      player: createPileAnchors(),
      opponent: createPileAnchors(),
    },
    hands: {
      player: new THREE.Group(),
      opponent: new THREE.Group(),
    },
  };
}

function rowAnchor(z: number): THREE.Group {
  const anchor = new THREE.Group();
  anchor.position.set(0, 0.22, z);
  return anchor;
}

function createPileAnchors(): BoardAnchors["piles"][PlayerId] {
  return {
    deck: new THREE.Group(),
    discard: new THREE.Group(),
    leader: new THREE.Group(),
  };
}

function cardPlayed(
  cardInstanceId: CardInstanceId,
  definitionId: string,
  payload: Record<string, unknown> = {},
): GameEvent {
  return event("card.played", {
    cardInstanceId,
    controllerId: "player",
    playerId: "player",
    rowId: "close",
    ...payload,
  }, definitionId);
}

function event(
  type: GameEvent["type"],
  payload: Record<string, unknown>,
  id: string = type,
): GameEvent {
  return {
    id,
    blocking: true,
    payload,
    sequence: 1,
    type,
  };
}
