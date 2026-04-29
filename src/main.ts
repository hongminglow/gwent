import "./style.css";
import { createThreeApp } from "./game/renderer/threeApp";
import { createMatchStore } from "./game/runtime/matchStore";
import type { GameAction } from "./game/simulation/actions";
import { createMatchFromFaction } from "./game/simulation/matchFlow";
import { createHud } from "./game/ui/hud/createHud";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const initialState = createMatchFromFaction({
  id: "phase-10-live-bridge",
  seed: "phase-10-live-bridge",
  playerFactionId: "northern-realms",
});
const store = createMatchStore(initialState);
const dispatchIntent = (action: GameAction) => {
  if (threeApp.isInputBlocked()) {
    return;
  }

  try {
    store.dispatch(action);
  } catch (error) {
    console.error(error);
  }
};
const hud = createHud(root, initialState, {
  onIntent: dispatchIntent,
});
const threeApp = createThreeApp(root, initialState, {
  onIntent: dispatchIntent,
  onInputBlockedChange: (blocked) => {
    hud.update(store.getState(), blocked);
  },
});
const unsubscribe = store.subscribe((state) => {
  threeApp.applyMatchState(state);
  hud.update(state, threeApp.isInputBlocked());
}, false);

threeApp.start();

window.addEventListener("beforeunload", () => {
  unsubscribe();
  threeApp.dispose();
  hud.dispose();
});
