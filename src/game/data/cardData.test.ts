import { describe, expect, it } from "vitest";
import { AVAILABLE_CARD_ART_IDS, assetManifest } from "../assets/manifest";
import { ALL_CARD_DEFINITIONS } from "./cards";
import { FACTIONS } from "./factions";
import { STARTER_DECKS, getStarterDeckDefinitions } from "./starterDecks";
import { validateCardData } from "./validateCardData";

describe("card data", () => {
  it("passes the card data validation contract", () => {
    const result = validateCardData();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("creates a playable starter deck for every MVP faction", () => {
    for (const faction of FACTIONS) {
      const starterDeck = STARTER_DECKS[faction.id];
      const definitions = getStarterDeckDefinitions(faction.id);

      expect(starterDeck.unitIds.length).toBeGreaterThanOrEqual(22);
      expect(starterDeck.specialIds.length).toBeLessThanOrEqual(10);
      expect(definitions.leader.id).toBe(starterDeck.leaderId);
      expect(definitions.deck).toHaveLength(starterDeck.unitIds.length + starterDeck.specialIds.length);
    }
  });

  it("declares asset manifest keys for generated card art and ability VFX hooks", () => {
    for (const cardId of AVAILABLE_CARD_ART_IDS) {
      expect(assetManifest.cards[`cards.${cardId}`]).toMatch(new RegExp(`/(public/)?assets/cards/${cardId}([.-].+)?\\.png$`));
    }

    expect(assetManifest.cards["cards.st-havekar-smuggler"]).toBeUndefined();

    for (const card of ALL_CARD_DEFINITIONS) {
      if (card.vfxKey) {
        expect(assetManifest.fx[card.vfxKey]).toBeTruthy();
      }
    }
  });
});
