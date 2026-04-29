import type { GameAction } from "./actions";
import { appendEvent } from "./events";
import { finishRedraw, passRound, playCard, redrawCard } from "./matchFlow";
import type { MatchState, PlayerId } from "./types";

export function matchReducer(state: MatchState, action: GameAction): MatchState {
  switch (action.type) {
    case "clear-event-log":
      return {
        ...state,
        eventLog: [],
      };

    case "start-redraw":
      return transitionPhase(state, action.playerId, "redraw");

    case "finish-redraw":
      return finishRedraw(state, action.playerId);

    case "pass-round":
      return passRound(state, action.playerId);

    case "redraw-card":
      return redrawCard(state, action.playerId, action.cardInstanceId);

    case "play-card":
      return playCard(state, action.playerId, action.cardInstanceId, action.rowId);

    case "use-leader":
      return appendEvent(state, "phase.changed", {
        reason: "action-not-implemented-in-phase-3",
        actionType: action.type,
      });

    default:
      return assertNever(action);
  }
}

function transitionPhase(
  state: MatchState,
  playerId: PlayerId,
  phase: MatchState["phase"],
): MatchState {
  const nextState: MatchState = {
    ...state,
    phase,
    round: {
      ...state.round,
      phase,
    },
  };

  return appendEvent(nextState, "phase.changed", {
    phase,
    playerId,
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}
