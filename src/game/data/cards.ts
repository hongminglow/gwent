import type { AbilityId, CardDefinition, CardFactionId, CardRarity, CardType, FactionId, RowId } from "../simulation/types";

type UnitInput = {
  id: string;
  name: string;
  faction: FactionId;
  rows: RowId[];
  power: number;
  abilities?: AbilityId[];
  rarity?: CardRarity;
  tags?: string[];
  type?: Extract<CardType, "unit" | "hero">;
};

type SpecialInput = {
  id: string;
  name: string;
  rows?: RowId[];
  abilities: AbilityId[];
  tags?: string[];
  rarity?: CardRarity;
};

type LeaderInput = {
  id: string;
  name: string;
  faction: FactionId;
  abilities?: AbilityId[];
  rows?: RowId[];
  tags?: string[];
};

export const NEUTRAL_SPECIAL_CARD_IDS = [
  "neutral-biting-frost",
  "neutral-impenetrable-fog",
  "neutral-torrential-rain",
  "neutral-clear-weather",
  "neutral-commanders-horn",
  "neutral-decoy",
  "neutral-scorch",
] as const;

export const LEADER_CARDS: CardDefinition[] = [
  leader({
    id: "northern-realms-foltest-king-of-temeria",
    name: "Foltest: King of Temeria",
    faction: "northern-realms",
    rows: ["ranged"],
    abilities: ["weather"],
    tags: ["leader:play-impenetrable-fog"],
  }),
  leader({
    id: "nilfgaard-emhyr-his-imperial-majesty",
    name: "Emhyr var Emreis: His Imperial Majesty",
    faction: "nilfgaardian-empire",
    rows: ["siege"],
    abilities: ["weather"],
    tags: ["leader:play-torrential-rain"],
  }),
  leader({
    id: "scoiatael-francesca-daisy-of-the-valley",
    name: "Francesca Findabair: Daisy of the Valley",
    faction: "scoiatael",
    tags: ["leader:draw-extra-card"],
  }),
  leader({
    id: "monsters-eredin-king-of-the-wild-hunt",
    name: "Eredin: King of the Wild Hunt",
    faction: "monsters",
    abilities: ["weather"],
    tags: ["leader:play-weather"],
  }),
];

export const NEUTRAL_SPECIAL_CARDS: CardDefinition[] = [
  special({
    id: "neutral-biting-frost",
    name: "Biting Frost",
    rows: ["close"],
    abilities: ["weather"],
    tags: ["weather"],
  }),
  special({
    id: "neutral-impenetrable-fog",
    name: "Impenetrable Fog",
    rows: ["ranged"],
    abilities: ["weather"],
    tags: ["weather"],
  }),
  special({
    id: "neutral-torrential-rain",
    name: "Torrential Rain",
    rows: ["siege"],
    abilities: ["weather"],
    tags: ["weather"],
  }),
  special({
    id: "neutral-clear-weather",
    name: "Clear Weather",
    abilities: ["clear-weather"],
  }),
  special({
    id: "neutral-commanders-horn",
    name: "Commander's Horn",
    abilities: ["commanders-horn"],
  }),
  special({
    id: "neutral-decoy",
    name: "Decoy",
    abilities: ["decoy"],
  }),
  special({
    id: "neutral-scorch",
    name: "Scorch",
    abilities: ["scorch"],
  }),
];

export const NORTHERN_REALMS_CARDS: CardDefinition[] = [
  unit({ id: "nr-ballista", name: "Ballista", faction: "northern-realms", rows: ["siege"], power: 6 }),
  unit({ id: "nr-blue-stripes-commando", name: "Blue Stripes Commando", faction: "northern-realms", rows: ["close"], power: 4, abilities: ["tight-bond"], tags: ["bond:blue-stripes-commando"] }),
  unit({ id: "nr-catapult", name: "Catapult", faction: "northern-realms", rows: ["siege"], power: 8, abilities: ["tight-bond"], tags: ["bond:catapult"] }),
  unit({ id: "nr-crinfrid-reavers-dragon-hunter", name: "Crinfrid Reavers Dragon Hunter", faction: "northern-realms", rows: ["ranged"], power: 5, abilities: ["tight-bond"], tags: ["bond:crinfrid-reavers"] }),
  unit({ id: "nr-dethmold", name: "Dethmold", faction: "northern-realms", rows: ["ranged"], power: 6 }),
  unit({ id: "nr-dun-banner-medic", name: "Dun Banner Medic", faction: "northern-realms", rows: ["siege"], power: 5, abilities: ["medic"] }),
  unit({ id: "nr-esterad-thyssen", name: "Esterad Thyssen", faction: "northern-realms", rows: ["close"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "nr-kaedweni-siege-expert", name: "Kaedweni Siege Expert", faction: "northern-realms", rows: ["siege"], power: 1, abilities: ["morale-boost"] }),
  unit({ id: "nr-keira-metz", name: "Keira Metz", faction: "northern-realms", rows: ["ranged"], power: 5 }),
  unit({ id: "nr-philippa-eilhart", name: "Philippa Eilhart", faction: "northern-realms", rows: ["ranged"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "nr-poor-infantry", name: "Poor Fucking Infantry", faction: "northern-realms", rows: ["close"], power: 1, abilities: ["tight-bond"], tags: ["bond:poor-infantry"] }),
  unit({ id: "nr-prince-stennis", name: "Prince Stennis", faction: "northern-realms", rows: ["close"], power: 5, abilities: ["spy"] }),
  unit({ id: "nr-redanian-foot-soldier", name: "Redanian Foot Soldier", faction: "northern-realms", rows: ["close"], power: 1 }),
  unit({ id: "nr-sabrina-glevissig", name: "Sabrina Glevissig", faction: "northern-realms", rows: ["ranged"], power: 4 }),
  unit({ id: "nr-sheala-de-tancarville", name: "Sheala de Tancarville", faction: "northern-realms", rows: ["ranged"], power: 5 }),
  unit({ id: "nr-siege-tower", name: "Siege Tower", faction: "northern-realms", rows: ["siege"], power: 6 }),
  unit({ id: "nr-siegfried-of-denesle", name: "Siegfried of Denesle", faction: "northern-realms", rows: ["close"], power: 5 }),
  unit({ id: "nr-sigismund-dijkstra", name: "Sigismund Dijkstra", faction: "northern-realms", rows: ["close"], power: 4, abilities: ["spy"] }),
  unit({ id: "nr-thaler", name: "Thaler", faction: "northern-realms", rows: ["siege"], power: 1, abilities: ["spy"] }),
  unit({ id: "nr-trebuchet", name: "Trebuchet", faction: "northern-realms", rows: ["siege"], power: 6 }),
  unit({ id: "nr-vernon-roche", name: "Vernon Roche", faction: "northern-realms", rows: ["close"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "nr-ves", name: "Ves", faction: "northern-realms", rows: ["close"], power: 5 }),
  unit({ id: "nr-yarpen-zigrin", name: "Yarpen Zigrin", faction: "northern-realms", rows: ["close"], power: 2 }),
];

export const NILFGAARDIAN_EMPIRE_CARDS: CardDefinition[] = [
  unit({ id: "ng-albrich", name: "Albrich", faction: "nilfgaardian-empire", rows: ["ranged"], power: 2 }),
  unit({ id: "ng-assire-var-anahid", name: "Assire var Anahid", faction: "nilfgaardian-empire", rows: ["ranged"], power: 6 }),
  unit({ id: "ng-black-infantry-archer", name: "Black Infantry Archer", faction: "nilfgaardian-empire", rows: ["ranged"], power: 10 }),
  unit({ id: "ng-cahir", name: "Cahir Mawr Dyffryn aep Ceallach", faction: "nilfgaardian-empire", rows: ["close"], power: 6 }),
  unit({ id: "ng-cynthia", name: "Cynthia", faction: "nilfgaardian-empire", rows: ["ranged"], power: 4 }),
  unit({ id: "ng-etolian-auxiliary-archers", name: "Etolian Auxiliary Archers", faction: "nilfgaardian-empire", rows: ["ranged"], power: 1, abilities: ["medic"] }),
  unit({ id: "ng-fringilla-vigo", name: "Fringilla Vigo", faction: "nilfgaardian-empire", rows: ["ranged"], power: 6 }),
  unit({ id: "ng-heavy-zerrikanian-fire-scorpion", name: "Heavy Zerrikanian Fire Scorpion", faction: "nilfgaardian-empire", rows: ["siege"], power: 10 }),
  unit({ id: "ng-impera-brigade-guard", name: "Impera Brigade Guard", faction: "nilfgaardian-empire", rows: ["close"], power: 3, abilities: ["tight-bond"], tags: ["bond:impera-brigade"] }),
  unit({ id: "ng-letho", name: "Letho of Gulet", faction: "nilfgaardian-empire", rows: ["close"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "ng-menno-coehoorn", name: "Menno Coehoorn", faction: "nilfgaardian-empire", rows: ["close"], power: 10, type: "hero", abilities: ["hero", "medic"], rarity: "legendary" }),
  unit({ id: "ng-morteisen", name: "Morteisen", faction: "nilfgaardian-empire", rows: ["close"], power: 3 }),
  unit({ id: "ng-morvran-voorhis", name: "Morvran Voorhis", faction: "nilfgaardian-empire", rows: ["siege"], power: 10 }),
  unit({ id: "ng-nausicaa-cavalry-rider", name: "Nausicaa Cavalry Rider", faction: "nilfgaardian-empire", rows: ["close"], power: 2, abilities: ["tight-bond"], tags: ["bond:nausicaa-cavalry"] }),
  unit({ id: "ng-puttkammer", name: "Puttkammer", faction: "nilfgaardian-empire", rows: ["ranged"], power: 3 }),
  unit({ id: "ng-rainfarn", name: "Rainfarn", faction: "nilfgaardian-empire", rows: ["close"], power: 4 }),
  unit({ id: "ng-renuald-aep-matsen", name: "Renuald aep Matsen", faction: "nilfgaardian-empire", rows: ["ranged"], power: 5 }),
  unit({ id: "ng-rotten-mangonel", name: "Rotten Mangonel", faction: "nilfgaardian-empire", rows: ["siege"], power: 3 }),
  unit({ id: "ng-shilard-fitz-oesterlen", name: "Shilard Fitz-Oesterlen", faction: "nilfgaardian-empire", rows: ["close"], power: 7, abilities: ["spy"] }),
  unit({ id: "ng-siege-engineer", name: "Siege Engineer", faction: "nilfgaardian-empire", rows: ["siege"], power: 6 }),
  unit({ id: "ng-stefan-skellen", name: "Stefan Skellen", faction: "nilfgaardian-empire", rows: ["close"], power: 9, abilities: ["spy"] }),
  unit({ id: "ng-sweers", name: "Sweers", faction: "nilfgaardian-empire", rows: ["ranged"], power: 2 }),
  unit({ id: "ng-tibor-eggebracht", name: "Tibor Eggebracht", faction: "nilfgaardian-empire", rows: ["ranged"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "ng-vanhemar", name: "Vanhemar", faction: "nilfgaardian-empire", rows: ["ranged"], power: 4 }),
  unit({ id: "ng-vattier-de-rideaux", name: "Vattier de Rideaux", faction: "nilfgaardian-empire", rows: ["close"], power: 4, abilities: ["spy"] }),
  unit({ id: "ng-vreemde", name: "Vreemde", faction: "nilfgaardian-empire", rows: ["close"], power: 2 }),
];

export const SCOIATAEL_CARDS: CardDefinition[] = [
  unit({ id: "st-barclay-els", name: "Barclay Els", faction: "scoiatael", rows: ["close", "ranged"], power: 6, abilities: ["agile"] }),
  unit({ id: "st-ciaran", name: "Ciaran aep Easnillien", faction: "scoiatael", rows: ["close", "ranged"], power: 3, abilities: ["agile"] }),
  unit({ id: "st-dennis-cranmer", name: "Dennis Cranmer", faction: "scoiatael", rows: ["close"], power: 6 }),
  unit({ id: "st-dol-blathanna-archer", name: "Dol Blathanna Archer", faction: "scoiatael", rows: ["ranged"], power: 4 }),
  unit({ id: "st-dol-blathanna-scout", name: "Dol Blathanna Scout", faction: "scoiatael", rows: ["close", "ranged"], power: 6, abilities: ["agile"] }),
  unit({ id: "st-dwarven-skirmisher", name: "Dwarven Skirmisher", faction: "scoiatael", rows: ["close"], power: 3, abilities: ["muster"], tags: ["muster:dwarven-skirmisher"] }),
  unit({ id: "st-eithne", name: "Eithne", faction: "scoiatael", rows: ["ranged"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "st-elven-skirmisher", name: "Elven Skirmisher", faction: "scoiatael", rows: ["ranged"], power: 2, abilities: ["muster"], tags: ["muster:elven-skirmisher"] }),
  unit({ id: "st-filavandrel", name: "Filavandrel aen Fidhail", faction: "scoiatael", rows: ["close", "ranged"], power: 6, abilities: ["agile"] }),
  unit({ id: "st-havekar-healer", name: "Havekar Healer", faction: "scoiatael", rows: ["ranged"], power: 0, abilities: ["medic"] }),
  unit({ id: "st-havekar-smuggler", name: "Havekar Smuggler", faction: "scoiatael", rows: ["close"], power: 5, abilities: ["muster"], tags: ["muster:havekar-smuggler"] }),
  unit({ id: "st-ida-emean", name: "Ida Emean aep Sivney", faction: "scoiatael", rows: ["ranged"], power: 6 }),
  unit({ id: "st-iorveth", name: "Iorveth", faction: "scoiatael", rows: ["ranged"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "st-isengrim", name: "Isengrim Faoiltiarna", faction: "scoiatael", rows: ["close"], power: 10, type: "hero", abilities: ["hero", "morale-boost"], rarity: "legendary" }),
  unit({ id: "st-mahakaman-defender", name: "Mahakaman Defender", faction: "scoiatael", rows: ["close"], power: 5 }),
  unit({ id: "st-milva", name: "Milva", faction: "scoiatael", rows: ["ranged"], power: 10, abilities: ["morale-boost"], rarity: "rare" }),
  unit({ id: "st-riordain", name: "Riordain", faction: "scoiatael", rows: ["ranged"], power: 1 }),
  unit({ id: "st-saesenthessis", name: "Saesenthessis", faction: "scoiatael", rows: ["ranged"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "st-toruviel", name: "Toruviel", faction: "scoiatael", rows: ["ranged"], power: 2 }),
  unit({ id: "st-vrihedd-brigade-recruit", name: "Vrihedd Brigade Recruit", faction: "scoiatael", rows: ["ranged"], power: 4 }),
  unit({ id: "st-vrihedd-brigade-veteran", name: "Vrihedd Brigade Veteran", faction: "scoiatael", rows: ["close", "ranged"], power: 5, abilities: ["agile"] }),
  unit({ id: "st-yaevinn", name: "Yaevinn", faction: "scoiatael", rows: ["close", "ranged"], power: 6, abilities: ["agile"] }),
];

export const MONSTERS_CARDS: CardDefinition[] = [
  unit({ id: "mo-arachas", name: "Arachas", faction: "monsters", rows: ["close"], power: 4, abilities: ["muster"], tags: ["muster:arachas"] }),
  unit({ id: "mo-arachas-behemoth", name: "Arachas Behemoth", faction: "monsters", rows: ["siege"], power: 6, abilities: ["muster"], tags: ["muster:arachas"] }),
  unit({ id: "mo-botchling", name: "Botchling", faction: "monsters", rows: ["close"], power: 4 }),
  unit({ id: "mo-celaeno-harpy", name: "Celaeno Harpy", faction: "monsters", rows: ["close", "ranged"], power: 2, abilities: ["agile"] }),
  unit({ id: "mo-cockatrice", name: "Cockatrice", faction: "monsters", rows: ["ranged"], power: 2 }),
  unit({ id: "mo-crone-brewess", name: "Crone: Brewess", faction: "monsters", rows: ["close"], power: 6, abilities: ["muster"], tags: ["muster:crone"] }),
  unit({ id: "mo-crone-weavess", name: "Crone: Weavess", faction: "monsters", rows: ["close"], power: 6, abilities: ["muster"], tags: ["muster:crone"] }),
  unit({ id: "mo-crone-whispess", name: "Crone: Whispess", faction: "monsters", rows: ["close"], power: 6, abilities: ["muster"], tags: ["muster:crone"] }),
  unit({ id: "mo-draug", name: "Draug", faction: "monsters", rows: ["close"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "mo-earth-elemental", name: "Earth Elemental", faction: "monsters", rows: ["siege"], power: 6 }),
  unit({ id: "mo-endrega", name: "Endrega", faction: "monsters", rows: ["ranged"], power: 2 }),
  unit({ id: "mo-fiend", name: "Fiend", faction: "monsters", rows: ["close"], power: 6 }),
  unit({ id: "mo-fire-elemental", name: "Fire Elemental", faction: "monsters", rows: ["siege"], power: 6 }),
  unit({ id: "mo-foglet", name: "Foglet", faction: "monsters", rows: ["close"], power: 2 }),
  unit({ id: "mo-forktail", name: "Forktail", faction: "monsters", rows: ["close"], power: 5 }),
  unit({ id: "mo-frightener", name: "Frightener", faction: "monsters", rows: ["close"], power: 5 }),
  unit({ id: "mo-gargoyle", name: "Gargoyle", faction: "monsters", rows: ["ranged"], power: 2 }),
  unit({ id: "mo-ghoul", name: "Ghoul", faction: "monsters", rows: ["close"], power: 1, abilities: ["muster"], tags: ["muster:ghoul"] }),
  unit({ id: "mo-grave-hag", name: "Grave Hag", faction: "monsters", rows: ["ranged"], power: 5 }),
  unit({ id: "mo-griffin", name: "Griffin", faction: "monsters", rows: ["close"], power: 5 }),
  unit({ id: "mo-harpy", name: "Harpy", faction: "monsters", rows: ["close", "ranged"], power: 2, abilities: ["agile"] }),
  unit({ id: "mo-ice-giant", name: "Ice Giant", faction: "monsters", rows: ["siege"], power: 5 }),
  unit({ id: "mo-imlerith", name: "Imlerith", faction: "monsters", rows: ["close"], power: 10, type: "hero", abilities: ["hero"], rarity: "legendary" }),
  unit({ id: "mo-kayran", name: "Kayran", faction: "monsters", rows: ["close", "ranged"], power: 8, type: "hero", abilities: ["hero", "morale-boost"], rarity: "legendary" }),
  unit({ id: "mo-nekker", name: "Nekker", faction: "monsters", rows: ["close"], power: 2, abilities: ["muster"], tags: ["muster:nekker"] }),
  unit({ id: "mo-plague-maiden", name: "Plague Maiden", faction: "monsters", rows: ["close"], power: 5 }),
  unit({ id: "mo-vampire-bruxa", name: "Vampire: Bruxa", faction: "monsters", rows: ["close"], power: 4, abilities: ["muster"], tags: ["muster:vampire"] }),
  unit({ id: "mo-vampire-ekimmara", name: "Vampire: Ekimmara", faction: "monsters", rows: ["close"], power: 4, abilities: ["muster"], tags: ["muster:vampire"] }),
  unit({ id: "mo-vampire-fleder", name: "Vampire: Fleder", faction: "monsters", rows: ["close"], power: 4, abilities: ["muster"], tags: ["muster:vampire"] }),
  unit({ id: "mo-vampire-garkain", name: "Vampire: Garkain", faction: "monsters", rows: ["close"], power: 4, abilities: ["muster"], tags: ["muster:vampire"] }),
  unit({ id: "mo-vampire-katakan", name: "Vampire: Katakan", faction: "monsters", rows: ["close"], power: 5, abilities: ["muster"], tags: ["muster:vampire"] }),
  unit({ id: "mo-werewolf", name: "Werewolf", faction: "monsters", rows: ["close"], power: 5 }),
  unit({ id: "mo-wyvern", name: "Wyvern", faction: "monsters", rows: ["ranged"], power: 2 }),
];

export const ALL_CARD_DEFINITIONS = [
  ...LEADER_CARDS,
  ...NEUTRAL_SPECIAL_CARDS,
  ...NORTHERN_REALMS_CARDS,
  ...NILFGAARDIAN_EMPIRE_CARDS,
  ...SCOIATAEL_CARDS,
  ...MONSTERS_CARDS,
];

export const CARD_DEFINITIONS_BY_ID: Record<string, CardDefinition> = Object.fromEntries(
  ALL_CARD_DEFINITIONS.map((card) => [card.id, card]),
);

function unit(input: UnitInput): CardDefinition {
  return card({
    id: input.id,
    name: input.name,
    faction: input.faction,
    type: input.type ?? "unit",
    rows: input.rows,
    basePower: input.power,
    abilities: input.abilities ?? [],
    rarity: input.rarity ?? "common",
    tags: input.tags ?? [],
  });
}

function special(input: SpecialInput): CardDefinition {
  return card({
    id: input.id,
    name: input.name,
    faction: "neutral",
    type: "special",
    rows: input.rows ?? [],
    basePower: 0,
    abilities: input.abilities,
    rarity: input.rarity ?? "common",
    tags: ["special", ...(input.tags ?? [])],
  });
}

function leader(input: LeaderInput): CardDefinition {
  return card({
    id: input.id,
    name: input.name,
    faction: input.faction,
    type: "leader",
    rows: input.rows ?? [],
    basePower: 0,
    abilities: input.abilities ?? [],
    rarity: "legendary",
    tags: ["leader", ...(input.tags ?? [])],
  });
}

function card(input: {
  id: string;
  name: string;
  faction: CardFactionId;
  type: CardType;
  rows: RowId[];
  basePower: number;
  abilities: AbilityId[];
  rarity: CardRarity;
  tags: string[];
}): CardDefinition {
  return {
    ...input,
    artKey: `cards.${input.id}`,
    vfxKey: getVfxKey(input.abilities),
  };
}

function getVfxKey(abilities: AbilityId[]): string | undefined {
  const primaryAbility = abilities.find((ability) =>
    ["scorch", "weather", "clear-weather", "commanders-horn", "decoy", "medic", "muster", "spy"].includes(
      ability,
    ),
  );

  return primaryAbility ? `fx.${primaryAbility}` : undefined;
}
