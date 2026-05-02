import { describe, expect, it } from "vitest";
import { createEvent } from "../simulation/events";
import { createEmptyMatchState } from "../simulation/matchState";
import type { CardDefinition, MatchState } from "../simulation/types";
import {
  clampVolume,
  getAudioCueFromRendererCue,
  getAudioCuesForGameEvent,
  normalizeSettings,
} from "./audioEngine";

describe("audio engine cue routing", () => {
  it("maps core match events to distinct audio cues", () => {
    const state = createAudioState();

    expect(getAudioCuesForGameEvent(createEvent(1, "card.drawn"), state)).toEqual(["card.draw"]);
    expect(getAudioCuesForGameEvent(createEvent(1, "card.drawn", {
      reason: "redraw",
    }), state)).toEqual(["redraw", "card.draw"]);
    expect(getAudioCuesForGameEvent(createEvent(2, "player.passed"), state)).toEqual(["pass"]);
    expect(getAudioCuesForGameEvent(createEvent(3, "leader.used"), state)).toEqual([]);
    expect(getAudioCuesForGameEvent(createEvent(4, "weather.applied"), state)).toEqual([]);
    expect(getAudioCuesForGameEvent(createEvent(5, "weather.cleared"), state)).toEqual([]);
    expect(getAudioCuesForGameEvent(createEvent(6, "row.buff.applied"), state)).toEqual([]);
    expect(getAudioCuesForGameEvent(createEvent(7, "turn.changed"), state)).toEqual(["turn"]);
    expect(getAudioCuesForGameEvent(createEvent(8, "phase.changed", {
      phase: "playing",
    }), state)).toEqual(["round.start"]);
  });

  it("maps card abilities and destruction to specialty cues", () => {
    const state = createAudioState();

    expect(getAudioCuesForGameEvent(createEvent(1, "card.played", {
      cardInstanceId: "spy-card",
    }), state)).toEqual(["card.play", "spy"]);
    expect(getAudioCuesForGameEvent(createEvent(2, "card.played", {
      cardInstanceId: "muster-card",
      reason: "muster",
    }), state)).toEqual(["card.play", "muster"]);
    expect(getAudioCuesForGameEvent(createEvent(3, "card.played", {
      cardInstanceId: "weather-card",
    }), state)).toEqual([]);
    expect(getAudioCuesForGameEvent(createEvent(3, "card.revived"), state)).toEqual(["medic"]);
    expect(getAudioCuesForGameEvent(createEvent(4, "card.destroyed", {
      reason: "scorch",
    }), state)).toEqual([]);
  });

  it("maps round and match outcomes from the player perspective", () => {
    const state = createAudioState();

    expect(getAudioCuesForGameEvent(createEvent(1, "round.ended", {
      winnerIds: ["player"],
    }), state)).toEqual(["card.discard", "round.win"]);
    expect(getAudioCuesForGameEvent(createEvent(2, "round.ended", {
      winnerIds: ["opponent"],
    }), state)).toEqual(["card.discard", "round.loss"]);
    expect(getAudioCuesForGameEvent(createEvent(3, "round.ended", {
      winnerIds: [],
    }), state)).toEqual(["card.discard", "round.draw"]);
    expect(getAudioCuesForGameEvent(createEvent(4, "match.ended", {
      winnerId: "player",
    }), state)).toEqual(["match.win"]);
    expect(getAudioCuesForGameEvent(createEvent(5, "match.ended", {
      winnerId: "opponent",
    }), state)).toEqual(["match.loss"]);
  });

  it("maps renderer and interaction audio cues", () => {
    expect(getAudioCueFromRendererCue({
      cue: "slain-slash",
    })).toBe("slain-slash");
    expect(getAudioCueFromRendererCue({
      cue: "slain-slash",
      reason: "scorch",
    })).toBe("card.destroy");
    expect(getAudioCueFromRendererCue({
      cardInstanceId: "card-1",
      cue: "card.hover",
    })).toBe("card.hover");
    expect(getAudioCueFromRendererCue({
      cue: "unknown",
    })).toBeUndefined();
  });

  it("normalizes audio settings", () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(normalizeSettings({
      masterVolume: Number.NaN,
      muted: true,
    })).toEqual({
      masterVolume: 0.84,
      muted: true,
    });
  });
});

function createAudioState(): MatchState {
  const spy = definition("spy-unit", ["spy"]);
  const muster = definition("muster-unit", ["muster"]);
  const weather = specialDefinition("weather-card", ["weather"]);

  return {
    ...createEmptyMatchState({
      id: "audio-test",
      opponentFactionId: "monsters",
      playerFactionId: "northern-realms",
      seed: "audio-seed",
    }),
    cardDefinitions: {
      [spy.id]: spy,
      [muster.id]: muster,
      [weather.id]: weather,
    },
    cards: {
      "muster-card": {
        controllerId: "player",
        definitionId: muster.id,
        id: "muster-card",
        ownerId: "player",
        zone: "hand",
        createdSequence: 1,
      },
      "spy-card": {
        controllerId: "player",
        definitionId: spy.id,
        id: "spy-card",
        ownerId: "player",
        zone: "hand",
        createdSequence: 2,
      },
      "weather-card": {
        controllerId: "player",
        definitionId: weather.id,
        id: "weather-card",
        ownerId: "player",
        zone: "hand",
        createdSequence: 3,
      },
    },
  };
}

function definition(id: string, abilities: CardDefinition["abilities"]): CardDefinition {
  return {
    abilities,
    audioKey: id,
    artKey: id,
    basePower: 4,
    faction: "neutral",
    id,
    name: id,
    rarity: "common",
    rows: ["close"],
    tags: [],
    type: "unit",
    vfxKey: id,
  };
}

function specialDefinition(id: string, abilities: CardDefinition["abilities"]): CardDefinition {
  return {
    ...definition(id, abilities),
    basePower: 0,
    rows: ["close", "ranged", "siege"],
    type: "special",
  };
}
