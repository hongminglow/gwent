import { ALL_CARD_DEFINITIONS } from "../data/cards";
import { FACTIONS } from "../data/factions";

export type AssetManifest = {
  cards: Record<string, string>;
  boards: Record<string, string>;
  factions: Record<string, string>;
  fx: Record<string, string>;
  audio: Record<string, string>;
  ui: Record<string, string>;
};

const VFX_KEYS = Array.from(
  new Set(ALL_CARD_DEFINITIONS.flatMap((card) => (card.vfxKey ? [card.vfxKey] : []))),
).sort();

export const assetManifest: AssetManifest = {
  cards: Object.fromEntries(
    ALL_CARD_DEFINITIONS.map((card) => [card.artKey, `/assets/cards/${card.id}.png`]),
  ),
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
