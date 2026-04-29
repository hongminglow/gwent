import type { GameEvent, GameEventType, MatchState } from "./types";

export function appendEvent(
  state: MatchState,
  type: GameEventType,
  payload: Record<string, unknown> = {},
  blocking = false,
): MatchState {
  const event = createEvent(state.nextEventSequence, type, payload, blocking);

  return {
    ...state,
    eventLog: [...state.eventLog, event],
    nextEventSequence: state.nextEventSequence + 1,
  };
}

export function createEvent(
  sequence: number,
  type: GameEventType,
  payload: Record<string, unknown> = {},
  blocking = false,
): GameEvent {
  return {
    id: `event-${sequence.toString().padStart(6, "0")}`,
    sequence,
    type,
    payload,
    blocking,
  };
}
