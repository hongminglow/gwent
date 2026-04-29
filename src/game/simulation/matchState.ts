import { FACTIONS } from "../data/factions";
import { createEvent } from "./events";
import { createRng } from "./random";
import type {
  BoardState,
  CardDefinition,
  FactionId,
  MatchId,
  MatchState,
  PlayerId,
  PlayerRowsState,
  PlayerState,
} from "./types";

export type CreateEmptyMatchOptions = {
  id: MatchId;
  seed: string;
  playerFactionId: FactionId;
  opponentFactionId: FactionId;
  activePlayerId?: PlayerId;
  cardDefinitions?: CardDefinition[];
};

export function createEmptyMatchState(options: CreateEmptyMatchOptions): MatchState {
  assertFactionExists(options.playerFactionId);
  assertFactionExists(options.opponentFactionId);

  const activePlayerId = options.activePlayerId ?? "player";

  return {
    id: options.id,
    rng: createRng(options.seed),
    phase: "setup",
    players: {
      player: createPlayerState("player", options.playerFactionId),
      opponent: createPlayerState("opponent", options.opponentFactionId),
    },
    board: createEmptyBoard(),
    cards: {},
    cardDefinitions: Object.fromEntries(
      (options.cardDefinitions ?? []).map((definition) => [definition.id, definition]),
    ),
    round: {
      number: 1,
      phase: "setup",
      activePlayerId,
      passed: {
        player: false,
        opponent: false,
      },
      winnerIds: [],
    },
    eventLog: [
      createEvent(1, "match.created", {
        matchId: options.id,
        playerFactionId: options.playerFactionId,
        opponentFactionId: options.opponentFactionId,
        activePlayerId,
      }),
    ],
    nextEventSequence: 2,
    nextCardInstanceSequence: 1,
  };
}

export function createEmptyBoard(): BoardState {
  return {
    rows: {
      player: createEmptyRows(),
      opponent: createEmptyRows(),
    },
    weather: {
      close: false,
      ranged: false,
      siege: false,
    },
  };
}

function createPlayerState(id: PlayerId, factionId: FactionId): PlayerState {
  return {
    id,
    factionId,
    deck: {
      cards: [],
    },
    hand: {
      cards: [],
      redrawsRemaining: 2,
      redrawComplete: false,
    },
    discard: {
      cards: [],
    },
    roundWins: 0,
    hasPassed: false,
    leaderUsed: false,
  };
}

function createEmptyRows(): PlayerRowsState {
  return {
    close: {
      cards: [],
      hornActive: false,
    },
    ranged: {
      cards: [],
      hornActive: false,
    },
    siege: {
      cards: [],
      hornActive: false,
    },
  };
}

function assertFactionExists(factionId: FactionId) {
  if (!FACTIONS.some((faction) => faction.id === factionId)) {
    throw new Error(`Unknown faction: ${factionId}`);
  }
}
