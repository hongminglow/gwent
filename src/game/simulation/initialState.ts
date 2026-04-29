import { FACTIONS } from "../data/factions";
import type { FactionId, MatchPreviewState, RowId } from "./types";

const ROWS: RowId[] = ["close", "ranged", "siege"];

export function createInitialMatchPreview(selectedFactionId: FactionId): MatchPreviewState {
  const selectedFaction = FACTIONS.find((faction) => faction.id === selectedFactionId);

  if (!selectedFaction) {
    throw new Error(`Unknown faction: ${selectedFactionId}`);
  }

  return {
    appName: "Oathbound",
    phase: "foundation-preview",
    selectedFaction,
    opponentPool: FACTIONS.filter((faction) => faction.id !== selectedFactionId),
    rows: ROWS,
    debug: {
      enabled: import.meta.env.DEV,
      seed: "phase-9-preview",
    },
  };
}
