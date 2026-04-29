import type { GameAction } from "../simulation/actions";
import { matchReducer } from "../simulation/reducer";
import type { MatchState } from "../simulation/types";

export type MatchStateListener = (state: MatchState) => void;

export type MatchStore = {
  getState: () => MatchState;
  dispatch: (action: GameAction) => MatchState;
  subscribe: (listener: MatchStateListener, emitCurrent?: boolean) => () => void;
};

export function createMatchStore(initialState: MatchState): MatchStore {
  let state = initialState;
  const listeners = new Set<MatchStateListener>();

  const emit = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    getState() {
      return state;
    },
    dispatch(action) {
      state = matchReducer(state, action);
      emit();
      return state;
    },
    subscribe(listener, emitCurrent = true) {
      listeners.add(listener);

      if (emitCurrent) {
        listener(state);
      }

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
