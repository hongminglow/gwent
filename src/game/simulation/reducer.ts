import type { GameAction } from "./actions";
import { appendEvent } from "./events";
import {
  debugForceHand,
  debugSkipRound,
  debugSpawnCard,
  debugTriggerAbility,
  debugTriggerScorch,
  debugTriggerSlain,
} from "./debugTools";
import { finishRedraw, passRound, playCard, redrawCard, useLeaderAbility } from "./matchFlow";
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
      return playCard(
        state,
        action.playerId,
        action.cardInstanceId,
        action.rowId,
        action.targetCardInstanceId,
      );

    case "use-leader":
      return useLeaderAbility(state, action.playerId, action.rowId);

    case "debug-force-hand":
      return debugForceHand(state, action.playerId, action.definitionIds);

    case "debug-spawn-card":
      return debugSpawnCard(state, {
        definitionId: action.definitionId,
        playerId: action.playerId,
        rowId: action.rowId,
        zone: action.zone,
      });

    case "debug-trigger-ability":
      return debugTriggerAbility(state, {
        abilityId: action.abilityId,
        playerId: action.playerId,
        rowId: action.rowId,
      });

    case "debug-trigger-scorch":
      return debugTriggerScorch(state, action.playerId, action.rowId);

    case "debug-trigger-slain":
      return debugTriggerSlain(state, action.playerId, action.rowId);

    case "debug-skip-round":
      return debugSkipRound(state, action.winnerId);

    case "debug-start-match":
      return state;

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
