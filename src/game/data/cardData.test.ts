import { describe, expect, it } from "vitest";
import { assetManifest } from "../assets/manifest";
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

  it("declares asset manifest keys for every card art and ability VFX hook", () => {
    for (const card of ALL_CARD_DEFINITIONS) {
      expect(assetManifest.cards[card.artKey]).toBe(`/assets/cards/${card.id}.png`);

      if (card.vfxKey) {
        expect(assetManifest.fx[card.vfxKey]).toBeTruthy();
      }
    }
  });
});
