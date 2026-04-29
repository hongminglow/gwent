export type PlayerId = "player" | "opponent";

export type FactionId =
  | "northern-realms"
  | "nilfgaardian-empire"
  | "scoiatael"
  | "monsters";

export type RowId = "close" | "ranged" | "siege";

export type CardType = "unit" | "hero" | "special" | "leader";

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

export type FactionDefinition = {
  id: FactionId;
  name: string;
  perk: string;
  tacticalIdentity: string;
  accentColor: string;
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
