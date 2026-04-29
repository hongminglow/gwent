import "./style.css";
import { createAudioEngine } from "./game/audio/audioEngine";
import type { CardInteractionHudState } from "./game/renderer/cardInteraction";
import { createThreeApp, type ThreeApp } from "./game/renderer/threeApp";
import { createMatchStore, type MatchStore } from "./game/runtime/matchStore";
import { isDebugAction, type GameAction } from "./game/simulation/actions";
import { chooseAiAction } from "./game/simulation/aiOpponent";
import { createMatchFromFaction } from "./game/simulation/matchFlow";
import type { FactionId, MatchState, PlayerId } from "./game/simulation/types";
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
let aiAutoplayEnabled = false;
let aiAutoplayTimerId: number | undefined;
const audio = createAudioEngine(root);

const menu = createMainMenu(root, {
  onStartMatch: (factionId) => {
    if (startTimerId !== undefined) {
      window.clearTimeout(startTimerId);
    }

    startTimerId = window.setTimeout(() => {
      startTimerId = undefined;
      try {
        startMatch(factionId);
      } catch (error) {
        handleStartError(error);
      }
    }, 420);
  },
});

function startMatch(playerFactionId: FactionId, opponentFactionId?: FactionId) {
  disposeSession();

  const matchSeed = `${playerFactionId}-${Date.now()}`;
  const initialState = createMatchFromFaction({
    id: `match-${Date.now()}`,
    opponentFactionId,
    playerFactionId,
    seed: matchSeed,
  });
  audio.beginMatch(initialState);
  const store = createMatchStore(initialState);
  const session: Partial<GameSession> = {
    interactionState: {
      validRows: [],
    },
    store,
  };
  const dispatchIntent = (action: GameAction) => {
    if (!isDebugAction(action) && session.threeApp?.isInputBlocked()) {
      return;
    }

    try {
      store.dispatch(action);
    } catch (error) {
      console.error(error);
    }
  };
  const hud = createHud(root, initialState, {
    audioSettings: audio.getSettings(),
    onAudioMutedChange: audio.setMuted,
    onAudioVolumeChange: audio.setMasterVolume,
    onDebugStartMatch: (nextPlayerFactionId, nextOpponentFactionId) => {
      startMatch(nextPlayerFactionId, nextOpponentFactionId);
    },
    onExitToMenu: showMainMenu,
    onIntent: dispatchIntent,
    onToggleAiAutoplay: setAiAutoplay,
    onToggleDebugCamera: (enabled) => session.threeApp?.setDebugCamera(enabled),
    onToggleFastAnimations: (enabled) => session.threeApp?.setFastAnimations(enabled),
    onTogglePlacementZones: (enabled) => session.threeApp?.setPlacementZones(enabled),
  });
  const threeApp = createThreeApp(root, initialState, {
    onAudioCue: audio.playRendererCue,
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
    audio.handleMatchState(state);
    scheduleAiAutoplay();
  }, false);

  session.hud = hud;
  session.threeApp = threeApp;
  session.unsubscribe = unsubscribe;
  activeSession = session as GameSession;
  menu.hideLoading();
  menu.hide();
  threeApp.start();
  scheduleAiAutoplay();
}

function handleStartError(error: unknown) {
  console.error(error);
  disposeSession();
  setAiAutoplay(false);
  menu.showError(error instanceof Error ? error.message : "The renderer failed while preparing the match.");
}

function showMainMenu() {
  setAiAutoplay(false);
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

function setAiAutoplay(enabled: boolean) {
  aiAutoplayEnabled = enabled;

  if (!enabled && aiAutoplayTimerId !== undefined) {
    window.clearTimeout(aiAutoplayTimerId);
    aiAutoplayTimerId = undefined;
  }

  if (enabled) {
    scheduleAiAutoplay();
  }
}

function scheduleAiAutoplay() {
  if (!aiAutoplayEnabled || !activeSession || aiAutoplayTimerId !== undefined) {
    return;
  }

  aiAutoplayTimerId = window.setTimeout(() => {
    aiAutoplayTimerId = undefined;
    runAiAutoplayStep();
  }, 460);
}

function runAiAutoplayStep() {
  const session = activeSession;

  if (!aiAutoplayEnabled || !session) {
    return;
  }

  if (session.threeApp.isInputBlocked()) {
    scheduleAiAutoplay();
    return;
  }

  const state = session.store.getState();
  const playerId = getAutoplayPlayer(state);
  const suggestion = playerId ? chooseAiAction(state, playerId)?.action : undefined;

  if (suggestion) {
    try {
      session.store.dispatch(suggestion);
    } catch (error) {
      console.error(error);
    }
  }

  scheduleAiAutoplay();
}

function getAutoplayPlayer(state: MatchState): PlayerId | undefined {
  if (state.phase === "redraw") {
    if (!state.players.player.hand.redrawComplete) {
      return "player";
    }

    if (!state.players.opponent.hand.redrawComplete) {
      return "opponent";
    }
  }

  if (state.phase === "playing") {
    return state.round.activePlayerId;
  }

  return undefined;
}

window.addEventListener("beforeunload", () => {
  if (startTimerId !== undefined) {
    window.clearTimeout(startTimerId);
  }

  disposeSession();
  setAiAutoplay(false);
  audio.dispose();
  menu.dispose();
});
