export type PlayerId = "player" | "opponent";

export type CardId = string;

export type CardInstanceId = string;

export type GameEventId = string;

export type MatchId = string;

export type FactionId =
  | "northern-realms"
  | "nilfgaardian-empire"
  | "scoiatael"
  | "monsters";

export type CardFactionId = FactionId | "neutral";

export type RowId = "close" | "ranged" | "siege";

export type CardType = "unit" | "hero" | "special" | "leader";

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export type AbilityId =
  | "agile"
  | "clear-weather"
  | "commanders-horn"
  | "decoy"
  | "hero"
  | "medic"
  | "morale-boost"
  | "muster"
  | "scorch"
  | "spy"
  | "tight-bond"
  | "weather";

export type CardZone = "deck" | "hand" | "board" | "discard" | "leader";

export type MatchPhase =
  | "setup"
  | "redraw"
  | "playing"
  | "round-complete"
  | "match-complete";

export type FactionDefinition = {
  id: FactionId;
  name: string;
  perk: string;
  tacticalIdentity: string;
  accentColor: string;
};

export type CardDefinition = {
  id: CardId;
  name: string;
  faction: CardFactionId;
  type: CardType;
  rows: RowId[];
  basePower: number;
  abilities: AbilityId[];
  rarity: CardRarity;
  tags: string[];
  artKey: string;
  vfxKey?: string;
  audioKey?: string;
};

export type CardInstance = {
  id: CardInstanceId;
  definitionId: CardId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  zone: CardZone;
  rowId?: RowId;
  createdSequence: number;
};

export type DeckState = {
  cards: CardInstanceId[];
};

export type HandState = {
  cards: CardInstanceId[];
  redrawsRemaining: number;
  redrawComplete: boolean;
};

export type RowState = {
  cards: CardInstanceId[];
  hornActive: boolean;
};

export type PlayerRowsState = Record<RowId, RowState>;

export type BoardState = {
  rows: Record<PlayerId, PlayerRowsState>;
  weather: Record<RowId, boolean>;
};

export type DiscardState = {
  cards: CardInstanceId[];
};

export type PlayerState = {
  id: PlayerId;
  factionId: FactionId;
  leaderCardId?: CardInstanceId;
  deck: DeckState;
  hand: HandState;
  discard: DiscardState;
  roundWins: number;
  hasPassed: boolean;
  leaderUsed: boolean;
};

export type RoundState = {
  number: number;
  phase: MatchPhase;
  activePlayerId: PlayerId;
  passed: Record<PlayerId, boolean>;
  winnerIds: PlayerId[];
};

export type RngState = {
  seed: string;
  value: number;
};

export type GameEventType =
  | "match.created"
  | "phase.changed"
  | "turn.changed"
  | "player.passed"
  | "card.drawn"
  | "card.played"
  | "card.destroyed"
  | "card.revived"
  | "weather.applied"
  | "weather.cleared"
  | "row.buff.applied"
  | "round.ended";

export type GameEvent = {
  id: GameEventId;
  sequence: number;
  type: GameEventType;
  payload: Record<string, unknown>;
  blocking: boolean;
};

export type MatchState = {
  id: MatchId;
  rng: RngState;
  phase: MatchPhase;
  players: Record<PlayerId, PlayerState>;
  board: BoardState;
  cards: Record<CardInstanceId, CardInstance>;
  cardDefinitions: Record<CardId, CardDefinition>;
  round: RoundState;
  eventLog: GameEvent[];
  nextEventSequence: number;
  nextCardInstanceSequence: number;
};

export type MatchPreviewState = {
  appName: string;
  phase: "foundation-preview";
  selectedFaction: FactionDefinition;
  opponentPool: FactionDefinition[];
  rows: RowId[];
  debug: {
    enabled: boolean;
    seed: string;
  };
};
