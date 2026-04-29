import type { GameAction } from "./actions";
import { appendEvent } from "./events";
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
    case "play-card":
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

function finishRedraw(state: MatchState, playerId: PlayerId): MatchState {
  const player = state.players[playerId];
  const nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: {
          ...player.hand,
          redrawComplete: true,
        },
      },
    },
  };

  return appendEvent(nextState, "phase.changed", {
    playerId,
    redrawComplete: true,
  });
}

function passRound(state: MatchState, playerId: PlayerId): MatchState {
  const player = state.players[playerId];
  const nextPassed = {
    ...state.round.passed,
    [playerId]: true,
  };
  const nextState: MatchState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hasPassed: true,
      },
    },
    round: {
      ...state.round,
      passed: nextPassed,
      activePlayerId: getOtherPlayerId(playerId),
    },
  };

  return appendEvent(nextState, "player.passed", {
    playerId,
  });
}

function getOtherPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "opponent" : "player";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}
