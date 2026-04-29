import type { MatchState } from "./types";

export function serializeMatchState(state: MatchState): string {
  return JSON.stringify(state);
}

export function restoreMatchState(serializedState: string): MatchState {
  return JSON.parse(serializedState) as MatchState;
}
