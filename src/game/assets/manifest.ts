import { ALL_CARD_DEFINITIONS, CARD_DEFINITIONS_BY_ID } from "../data/cards";
import { FACTIONS } from "../data/factions";
import { generatedCardArtUrls } from "./generatedCardArt";

export type AssetManifest = {
  cards: Partial<Record<string, string>>;
  boards: Record<string, string>;
  factions: Record<string, string>;
  fx: Record<string, string>;
  audio: Record<string, string>;
  ui: Record<string, string>;
};

const VFX_KEYS = Array.from(
  new Set(ALL_CARD_DEFINITIONS.flatMap((card) => (card.vfxKey ? [card.vfxKey] : []))),
).sort();

export const AVAILABLE_CARD_ART_IDS = [
  "neutral-biting-frost",
  "neutral-impenetrable-fog",
  "neutral-torrential-rain",
  "neutral-clear-weather",
  "neutral-commanders-horn",
  "neutral-decoy",
  "neutral-scorch",
  "nr-ballista",
  "nr-blue-stripes-commando",
  "nr-catapult",
  "nr-crinfrid-reavers-dragon-hunter",
  "nr-dethmold",
  "nr-dun-banner-medic",
  "nr-esterad-thyssen",
  "nr-kaedweni-siege-expert",
  "nr-keira-metz",
  "nr-philippa-eilhart",
  "nr-poor-infantry",
  "nr-prince-stennis",
  "nr-redanian-foot-soldier",
  "nr-sabrina-glevissig",
  "nr-sheala-de-tancarville",
  "nr-siege-tower",
  "nr-siegfried-of-denesle",
  "nr-sigismund-dijkstra",
  "nr-thaler",
  "nr-trebuchet",
  "nr-vernon-roche",
  "nr-ves",
  "nr-yarpen-zigrin",
  "ng-albrich",
  "ng-assire-var-anahid",
  "ng-black-infantry-archer",
  "ng-cahir",
  "ng-cynthia",
  "ng-etolian-auxiliary-archers",
  "ng-fringilla-vigo",
  "ng-heavy-zerrikanian-fire-scorpion",
  "ng-impera-brigade-guard",
  "ng-letho",
  "ng-menno-coehoorn",
  "ng-morteisen",
  "ng-morvran-voorhis",
  "ng-nausicaa-cavalry-rider",
  "ng-puttkammer",
  "ng-rainfarn",
  "ng-renuald-aep-matsen",
  "ng-rotten-mangonel",
  "ng-shilard-fitz-oesterlen",
  "ng-siege-engineer",
  "ng-stefan-skellen",
  "ng-sweers",
  "ng-tibor-eggebracht",
  "ng-vanhemar",
  "ng-vattier-de-rideaux",
  "ng-vreemde",
  "st-barclay-els",
  "st-ciaran",
  "st-dennis-cranmer",
  "st-dol-blathanna-archer",
  "st-dol-blathanna-scout",
  "st-dwarven-skirmisher",
  "st-eithne",
  "st-elven-skirmisher",
  "st-filavandrel",
  "st-havekar-healer",
  "st-havekar-smuggler",
  "st-ida-emean",
  "st-iorveth",
  "st-isengrim",
  "st-mahakaman-defender",
  "st-milva",
  "st-riordain",
  "st-saesenthessis",
  "st-toruviel",
  "st-vrihedd-brigade-recruit",
  "st-vrihedd-brigade-veteran",
  "st-yaevinn",
  "mo-arachas",
  "mo-arachas-behemoth",
  "mo-botchling",
  "mo-celaeno-harpy",
  "mo-cockatrice",
  "mo-crone-brewess",
  "mo-crone-weavess",
  "mo-crone-whispess",
  "mo-draug",
  "mo-earth-elemental",
  "mo-endrega",
  "mo-fiend",
  "mo-fire-elemental",
  "mo-foglet",
  "mo-forktail",
  "mo-frightener",
  "mo-gargoyle",
  "mo-ghoul",
  "mo-grave-hag",
  "mo-griffin",
  "mo-harpy",
  "mo-ice-giant",
  "mo-imlerith",
  "mo-kayran",
  "mo-nekker",
  "mo-plague-maiden",
  "mo-vampire-bruxa",
  "mo-vampire-ekimmara",
  "mo-vampire-fleder",
  "mo-vampire-garkain",
  "mo-vampire-katakan",
  "mo-werewolf",
  "mo-wyvern",
] as const;

export type AvailableCardArtId = (typeof AVAILABLE_CARD_ART_IDS)[number];

const CARD_ART_MANIFEST = Object.fromEntries(
  AVAILABLE_CARD_ART_IDS.map((cardId) => {
    const card = CARD_DEFINITIONS_BY_ID[cardId];

    if (!card) {
      throw new Error(`Available card art references an unknown card: ${cardId}`);
    }

    const artUrl = generatedCardArtUrls[cardId];

    if (!artUrl) {
      throw new Error(`Available card art is missing a generated image file: ${cardId}`);
    }

    return [card.artKey, artUrl];
  }),
);

export const assetManifest: AssetManifest = {
  cards: CARD_ART_MANIFEST,
  boards: {
    "boards.default": "/assets/boards/default-table.glb",
  },
  factions: Object.fromEntries(
    FACTIONS.map((faction) => [`factions.${faction.id}`, `/assets/factions/${faction.id}.webp`]),
  ),
  fx: Object.fromEntries(
    VFX_KEYS.map((key) => [key, `/assets/fx/${key.replace("fx.", "")}.json`]),
  ),
  audio: {},
  ui: {},
};
