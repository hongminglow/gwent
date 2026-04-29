import type { FactionDefinition } from "../simulation/types";

export const FACTIONS: FactionDefinition[] = [
  {
    id: "northern-realms",
    name: "Northern Realms",
    perk: "Draw one extra card after winning a round.",
    tacticalIdentity: "Balanced military pressure, siege strength, Tight Bond, and spies.",
    accentColor: "#3d7edb",
  },
  {
    id: "nilfgaardian-empire",
    name: "Nilfgaardian Empire",
    perk: "Win rounds that end in a draw.",
    tacticalIdentity: "Control tools, spies, medics, high-value units, and tie pressure.",
    accentColor: "#d6bb73",
  },
  {
    id: "scoiatael",
    name: "Scoia'tael",
    perk: "Decide who takes the first turn.",
    tacticalIdentity: "Agile placement, flexible rows, and tactical opening control.",
    accentColor: "#4ca866",
  },
  {
    id: "monsters",
    name: "Monsters",
    perk: "Keep one random unit card on the battlefield after each round.",
    tacticalIdentity: "Muster swarms, carryover pressure, and dangerous row stacking.",
    accentColor: "#b6423d",
  },
];
