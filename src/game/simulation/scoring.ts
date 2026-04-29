import type { MatchState, PlayerId } from "./types";

export type ScoreSnapshot = Record<PlayerId, number>;

export function calculateScores(state: MatchState): ScoreSnapshot {
  return {
    player: calculatePlayerScore(state, "player"),
    opponent: calculatePlayerScore(state, "opponent"),
  };
}

export function calculatePlayerScore(state: MatchState, playerId: PlayerId): number {
  const rows = state.board.rows[playerId];
  let total = 0;

  for (const row of Object.values(rows)) {
    for (const cardInstanceId of row.cards) {
      const card = state.cards[cardInstanceId];
      const definition = state.cardDefinitions[card.definitionId];
      total += definition.basePower;
    }
  }

  return total;
}
