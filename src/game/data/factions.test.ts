import { describe, expect, it } from "vitest";
import { FACTIONS } from "./factions";

describe("faction data", () => {
  it("defines the four base factions for the MVP", () => {
    expect(FACTIONS.map((faction) => faction.id)).toEqual([
      "northern-realms",
      "nilfgaardian-empire",
      "scoiatael",
      "monsters",
    ]);
  });

  it("keeps every faction playable with visible identity data", () => {
    for (const faction of FACTIONS) {
      expect(faction.name).toBeTruthy();
      expect(faction.perk).toBeTruthy();
      expect(faction.tacticalIdentity).toBeTruthy();
      expect(faction.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
