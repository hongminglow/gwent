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
