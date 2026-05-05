import { afterEach, describe, expect, it, vi } from "vitest";
import { assetManifest } from "./manifest";
import { preloadCardArtForMatch } from "./cardArtPreloader";
import { createMatchFromFaction } from "../simulation/matchFlow";
import type { CardInstanceId, MatchState } from "../simulation/types";

type LoadedImage = {
  priority: string | undefined;
  url: string;
};

describe("card art preloader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads hand and leader art before background match art", async () => {
    const loadedImages: LoadedImage[] = [];

    vi.stubGlobal("Image", createMockImageConstructor(loadedImages));

    const state = createMatchFromFaction({
      id: "preload-test",
      seed: "preload-scoiatael",
      playerFactionId: "scoiatael",
      opponentFactionId: "northern-realms",
    });
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    const result = await preloadCardArtForMatch(state, {
      onProgress: (progress) => progressUpdates.push(progress),
    });

    const priorityUrls = getExpectedPriorityUrls(state);

    expect(loadedImages).toHaveLength(result.total);
    expect(result.completed).toBe(result.total);
    expect(progressUpdates.at(-1)).toEqual(result);
    expect(loadedImages.slice(0, priorityUrls.length)).toEqual(
      priorityUrls.map((url) => ({
        priority: "high",
        url,
      })),
    );
    expect(loadedImages.slice(priorityUrls.length).every((entry) => entry.priority === "auto")).toBe(true);
  });
});

function createMockImageConstructor(loadedImages: LoadedImage[]) {
  return class MockImage {
    decoding = "async";
    loading = "eager";
    onerror: (() => void) | undefined;
    onload: (() => void) | undefined;
    private readonly attributes = new Map<string, string>();

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }

    decode() {
      return Promise.resolve();
    }

    set src(url: string) {
      loadedImages.push({
        priority: this.attributes.get("fetchpriority"),
        url,
      });
      queueMicrotask(() => this.onload?.());
    }
  };
}

function getExpectedPriorityUrls(state: MatchState): string[] {
  const cardIds = [
    ...state.players.player.hand.cards,
    state.players.player.leaderCardId,
    ...state.players.opponent.hand.cards,
    state.players.opponent.leaderCardId,
  ].filter((cardId): cardId is CardInstanceId => Boolean(cardId));

  return uniqueUrls(cardIds.map((cardId) => {
    const card = state.cards[cardId];
    const definition = state.cardDefinitions[card.definitionId];

    return assetManifest.cards[definition.artKey];
  }));
}

function uniqueUrls(urls: (string | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}
