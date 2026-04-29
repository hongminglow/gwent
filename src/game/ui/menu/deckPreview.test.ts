import { describe, expect, it } from "vitest";
import { createDeckPreviewModel } from "./deckPreview";

describe("deck preview model", () => {
  it("summarizes faction deck counts and leader data", () => {
    const preview = createDeckPreviewModel("northern-realms");

    expect(preview.faction.name).toBe("Northern Realms");
    expect(preview.leader.type).toBe("leader");
    expect(preview.counts.units).toBeGreaterThanOrEqual(22);
    expect(preview.counts.specials).toBeLessThanOrEqual(10);
    expect(preview.counts.total).toBe(preview.counts.units + preview.counts.specials);
    expect(preview.counts.totalPower).toBeGreaterThan(0);
    expect(preview.cards.some((card) => card.count > 1)).toBe(true);
  });

  it("extracts a compact ability summary", () => {
    const preview = createDeckPreviewModel("monsters");

    expect(preview.abilitySummary.length).toBeGreaterThan(0);
    expect(preview.abilitySummary.join(" ")).toContain("Muster");
  });
});
