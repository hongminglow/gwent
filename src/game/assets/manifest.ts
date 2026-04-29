export type AssetManifest = {
  cards: Record<string, string>;
  boards: Record<string, string>;
  factions: Record<string, string>;
  fx: Record<string, string>;
  audio: Record<string, string>;
  ui: Record<string, string>;
};

export const assetManifest: AssetManifest = {
  cards: {},
  boards: {},
  factions: {},
  fx: {},
  audio: {},
  ui: {},
};
