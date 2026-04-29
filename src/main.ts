import "./style.css";
import type { CardInteractionHudState } from "./game/renderer/cardInteraction";
import { createThreeApp, type ThreeApp } from "./game/renderer/threeApp";
import { createMatchStore, type MatchStore } from "./game/runtime/matchStore";
import type { GameAction } from "./game/simulation/actions";
import { createMatchFromFaction } from "./game/simulation/matchFlow";
import type { FactionId } from "./game/simulation/types";
import { createHud, type Hud } from "./game/ui/hud/createHud";
import { createMainMenu } from "./game/ui/menu/createMainMenu";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (!rootElement) {
  throw new Error("Missing #app root element.");
}

const root = rootElement;

type GameSession = {
  hud: Hud;
  interactionState: CardInteractionHudState;
  store: MatchStore;
  threeApp: ThreeApp;
  unsubscribe: () => void;
};

let activeSession: GameSession | undefined;
let startTimerId: number | undefined;

const menu = createMainMenu(root, {
  onStartMatch: (factionId) => {
    if (startTimerId !== undefined) {
      window.clearTimeout(startTimerId);
    }

    startTimerId = window.setTimeout(() => {
      startTimerId = undefined;
      startMatch(factionId);
    }, 420);
  },
});

function startMatch(playerFactionId: FactionId) {
  disposeSession();

  const matchSeed = `${playerFactionId}-${Date.now()}`;
  const initialState = createMatchFromFaction({
    id: `match-${Date.now()}`,
    playerFactionId,
    seed: matchSeed,
  });
  const store = createMatchStore(initialState);
  const session: Partial<GameSession> = {
    interactionState: {
      validRows: [],
    },
    store,
  };
  const dispatchIntent = (action: GameAction) => {
    if (session.threeApp?.isInputBlocked()) {
      return;
    }

    try {
      store.dispatch(action);
    } catch (error) {
      console.error(error);
    }
  };
  const hud = createHud(root, initialState, {
    onExitToMenu: showMainMenu,
    onIntent: dispatchIntent,
    onToggleDebugCamera: (enabled) => session.threeApp?.setDebugCamera(enabled),
    onToggleFastAnimations: (enabled) => session.threeApp?.setFastAnimations(enabled),
  });
  const threeApp = createThreeApp(root, initialState, {
    onInputBlockedChange: (blocked) => {
      hud.update(store.getState(), blocked, session.interactionState);
    },
    onInteractionChange: (nextInteractionState) => {
      session.interactionState = nextInteractionState;
      hud.setInteraction(nextInteractionState);
    },
    onIntent: dispatchIntent,
  });
  const unsubscribe = store.subscribe((state) => {
    threeApp.applyMatchState(state);
    hud.update(state, threeApp.isInputBlocked(), session.interactionState);
  }, false);

  session.hud = hud;
  session.threeApp = threeApp;
  session.unsubscribe = unsubscribe;
  activeSession = session as GameSession;
  menu.hideLoading();
  menu.hide();
  threeApp.start();
}

function showMainMenu() {
  disposeSession();
  menu.show();
}

function disposeSession() {
  if (!activeSession) {
    return;
  }

  activeSession.unsubscribe();
  activeSession.threeApp.dispose();
  activeSession.hud.dispose();
  activeSession = undefined;
}

window.addEventListener("beforeunload", () => {
  if (startTimerId !== undefined) {
    window.clearTimeout(startTimerId);
  }

  disposeSession();
  menu.dispose();
});
