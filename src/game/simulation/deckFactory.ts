import type { CardDefinition, CardFactionId, FactionId, RowId } from "./types";

export type StarterDeckDefinitions = {
  leader: CardDefinition;
  deck: CardDefinition[];
};

const ROW_SEQUENCE: RowId[] = ["close", "ranged", "siege"];

export function createGeneratedStarterDeck(factionId: FactionId): StarterDeckDefinitions {
  const factionSlug = factionId;
  const leader: CardDefinition = {
    id: `${factionSlug}-leader`,
    name: `${formatFactionName(factionId)} Leader`,
    faction: factionId,
    type: "leader",
    rows: [],
    basePower: 0,
    abilities: [],
    rarity: "legendary",
    tags: ["leader", "generated"],
    artKey: `cards.${factionSlug}.leader`,
  };

  const units = Array.from({ length: 22 }, (_, index): CardDefinition => {
    const cardNumber = index + 1;
    const row = ROW_SEQUENCE[index % ROW_SEQUENCE.length];

    return {
      id: `${factionSlug}-unit-${cardNumber.toString().padStart(2, "0")}`,
      name: `${formatFactionName(factionId)} Unit ${cardNumber}`,
      faction: factionId,
      type: "unit",
      rows: [row],
      basePower: 1 + (index % 10),
      abilities: [],
      rarity: "common",
      tags: ["generated", row],
      artKey: `cards.${factionSlug}.unit-${cardNumber}`,
    };
  });

  return {
    leader,
    deck: [...units, ...createGeneratedSpecials(factionId)],
  };
}

function createGeneratedSpecials(factionId: CardFactionId): CardDefinition[] {
  return [
    {
      id: `${factionId}-special-scorch`,
      name: "Scorch",
      faction: "neutral",
      type: "special",
      rows: [],
      basePower: 0,
      abilities: ["scorch"],
      rarity: "rare",
      tags: ["generated", "special"],
      artKey: "cards.neutral.scorch",
    },
    {
      id: `${factionId}-special-clear-weather`,
      name: "Clear Weather",
      faction: "neutral",
      type: "special",
      rows: [],
      basePower: 0,
      abilities: ["clear-weather"],
      rarity: "common",
      tags: ["generated", "special"],
      artKey: "cards.neutral.clear-weather",
    },
    {
      id: `${factionId}-special-commanders-horn`,
      name: "Commander's Horn",
      faction: "neutral",
      type: "special",
      rows: [],
      basePower: 0,
      abilities: ["commanders-horn"],
      rarity: "rare",
      tags: ["generated", "special"],
      artKey: "cards.neutral.commanders-horn",
    },
    {
      id: `${factionId}-special-decoy`,
      name: "Decoy",
      faction: "neutral",
      type: "special",
      rows: [],
      basePower: 0,
      abilities: ["decoy"],
      rarity: "common",
      tags: ["generated", "special"],
      artKey: "cards.neutral.decoy",
    },
  ];
}

function formatFactionName(factionId: FactionId): string {
  return factionId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
