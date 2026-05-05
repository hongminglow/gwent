import { assetManifest } from "./manifest";
import type { CardInstanceId, MatchState, PlayerId } from "../simulation/types";

export type CardArtPreloadProgress = {
  completed: number;
  total: number;
};

export type CardArtPreloadOptions = {
  onProgress?: (progress: CardArtPreloadProgress) => void;
};

const PLAYERS: PlayerId[] = ["player", "opponent"];
const MAX_BACKGROUND_ART_LOADS = 4;

export async function preloadCardArtForMatch(
  state: MatchState,
  options: CardArtPreloadOptions = {},
): Promise<CardArtPreloadProgress> {
  const priorityUrls = getPriorityCardArtUrls(state);
  const allUrls = getMatchCardArtUrls(state);
  const backgroundUrls = allUrls.filter((url) => !priorityUrls.includes(url));
  const total = allUrls.length;
  let completed = 0;

  const report = () => options.onProgress?.({
    completed,
    total,
  });
  const loadUrl = async (url: string, priority: "high" | "auto") => {
    await preloadImage(url, priority);
    completed += 1;
    report();
  };

  report();
  await Promise.all(priorityUrls.map((url) => loadUrl(url, "high")));
  await preloadInBatches(backgroundUrls, MAX_BACKGROUND_ART_LOADS, (url) => loadUrl(url, "auto"));

  return {
    completed,
    total,
  };
}

export function getMatchCardArtUrls(state: MatchState): string[] {
  return uniqueUrls(Object.values(state.cards).map((card) => getCardArtUrl(state, card.id)));
}

function getPriorityCardArtUrls(state: MatchState): string[] {
  const cardIds = PLAYERS.flatMap((playerId) => [
    ...state.players[playerId].hand.cards,
    state.players[playerId].leaderCardId,
  ]);

  return uniqueUrls(cardIds.map((cardId) => (cardId ? getCardArtUrl(state, cardId) : undefined)));
}

function getCardArtUrl(state: MatchState, cardInstanceId: CardInstanceId): string | undefined {
  const card = state.cards[cardInstanceId];
  const definition = card ? state.cardDefinitions[card.definitionId] : undefined;

  return definition ? assetManifest.cards[definition.artKey] : undefined;
}

function uniqueUrls(urls: (string | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

async function preloadInBatches(
  urls: string[],
  batchSize: number,
  load: (url: string) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < urls.length; index += batchSize) {
    await Promise.all(urls.slice(index, index + batchSize).map(load));
  }
}

function preloadImage(url: string, priority: "high" | "auto"): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.decoding = priority === "high" ? "sync" : "async";
    image.loading = "eager";
    image.setAttribute("fetchpriority", priority);
    image.onload = () => {
      image.decode()
        .then(resolve)
        .catch(resolve);
    };
    image.onerror = () => reject(new Error(`Unable to preload card art: ${url}`));
    image.src = url;
  });
}
