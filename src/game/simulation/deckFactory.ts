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
    const abilities = getGeneratedUnitAbilities(index);
    const rows = abilities.includes("agile") ? (["close", "ranged"] as RowId[]) : [row];
    const tags = ["generated", row, ...getGeneratedUnitTags(index)];

    return {
      id: `${factionSlug}-unit-${cardNumber.toString().padStart(2, "0")}`,
      name: `${formatFactionName(factionId)} Unit ${cardNumber}`,
      faction: factionId,
      type: "unit",
      rows,
      basePower: 1 + (index % 10),
      abilities,
      rarity: "common",
      tags,
      artKey: `cards.${factionSlug}.unit-${cardNumber}`,
    };
  });

  return {
    leader,
    deck: [...units, ...createGeneratedSpecials(factionId)],
  };
}

function getGeneratedUnitTags(index: number): string[] {
  if (index === 2 || index === 3) {
    return ["muster:generated-pack"];
  }

  if (index === 4 || index === 5) {
    return ["bond:generated-bond"];
  }

  return [];
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
    {
      id: `${factionId}-special-biting-frost`,
      name: "Biting Frost",
      faction: "neutral",
      type: "special",
      rows: ["close"],
      basePower: 0,
      abilities: ["weather"],
      rarity: "common",
      tags: ["generated", "special", "weather"],
      artKey: "cards.neutral.biting-frost",
    },
    {
      id: `${factionId}-special-impenetrable-fog`,
      name: "Impenetrable Fog",
      faction: "neutral",
      type: "special",
      rows: ["ranged"],
      basePower: 0,
      abilities: ["weather"],
      rarity: "common",
      tags: ["generated", "special", "weather"],
      artKey: "cards.neutral.impenetrable-fog",
    },
    {
      id: `${factionId}-special-torrential-rain`,
      name: "Torrential Rain",
      faction: "neutral",
      type: "special",
      rows: ["siege"],
      basePower: 0,
      abilities: ["weather"],
      rarity: "common",
      tags: ["generated", "special", "weather"],
      artKey: "cards.neutral.torrential-rain",
    },
  ];
}

function getGeneratedUnitAbilities(index: number): CardDefinition["abilities"] {
  if (index === 0) {
    return ["spy"];
  }

  if (index === 1) {
    return ["medic"];
  }

  if (index === 2 || index === 3) {
    return ["muster"];
  }

  if (index === 4 || index === 5) {
    return ["tight-bond"];
  }

  if (index === 6) {
    return ["morale-boost"];
  }

  if (index === 7) {
    return ["agile"];
  }

  return [];
}

function formatFactionName(factionId: FactionId): string {
  return factionId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
