const cardArtModules = import.meta.glob<string>("../../../public/assets/cards/*.png", {
  eager: true,
  import: "default",
});

const CARD_ART_FILE_PATTERN = /\/([^/]+)\.png$/;

export const generatedCardArtUrls: Readonly<Partial<Record<string, string>>> = Object.freeze(
  Object.fromEntries(
    Object.entries(cardArtModules).map(([path, url]) => {
      const cardId = CARD_ART_FILE_PATTERN.exec(path.replaceAll("\\", "/"))?.[1];

      if (!cardId) {
        throw new Error(`Generated card art path does not include a card id: ${path}`);
      }

      return [cardId, url];
    }),
  ),
);
