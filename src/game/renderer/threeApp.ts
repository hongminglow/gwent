import * as THREE from "three";
import { debugFlags } from "../diagnostics/debugFlags";
import { actionFromKeyboardEvent } from "../input/inputMap";
import type { GameAction } from "../simulation/actions";
import type { MatchState } from "../simulation/types";
import { createVisualAnimationQueue } from "./animationQueue";
import { createBoardScene } from "./boardScene";
import { createCardInteractionController, type CardInteractionHudState } from "./cardInteraction";
import { createCameraRig } from "./cameraRig";
import { createGameTextureLoader } from "./loaders/textureLoader";
import { createSimulationRenderer } from "./simulationBridge";

export type ThreeApp = {
  applyMatchState: (state: MatchState, options?: { animateEvents?: boolean }) => void;
  dispose: () => void;
  isInputBlocked: () => boolean;
  setDebugCamera: (enabled: boolean) => void;
  setFastAnimations: (enabled: boolean) => void;
  setPlacementZones: (enabled: boolean) => void;
  start: () => void;
};

export type ThreeAppOptions = {
  onInteractionChange?: (state: CardInteractionHudState) => void;
  onIntent?: (action: GameAction) => void;
  onInputBlockedChange?: (blocked: boolean) => void;
};

export function createThreeApp(
  root: HTMLElement,
  initialState: MatchState,
  options: ThreeAppOptions = {},
): ThreeApp {
  const shell = root.querySelector<HTMLElement>(".app-shell") ?? createShell(root);
  const sceneLayer = document.createElement("div");
  sceneLayer.className = "scene-layer";
  shell.prepend(sceneLayer);

  const scene = createScene();
  const renderer = createRenderer();
  sceneLayer.appendChild(renderer.domElement);

  const textureLoader = createGameTextureLoader(renderer);
  const cameraRig = createCameraRig(renderer.domElement);
  cameraRig.setDebugMode(debugFlags.debugCamera);
  scene.add(cameraRig.root);

  const board = createBoardScene();
  scene.add(board.root);
  const animationQueue = createVisualAnimationQueue();
  let latestState = initialState;
  let latestInputBlocked = animationQueue.isBlocking();
  const simulationRenderer = createSimulationRenderer(board.root, board.anchors, animationQueue, {
    onAudioCue: emitRendererAudioCue,
    onCameraFocus: (worldPosition, intensity) => cameraRig.focusAt(worldPosition, intensity),
  });
  simulationRenderer.applySnapshot(initialState, { animateEvents: false });
  const cardInteraction = createCardInteractionController({
    board,
    camera: cameraRig.camera,
    domElement: renderer.domElement,
    getState: () => latestState,
    isInputBlocked: () => animationQueue.isBlocking(),
    onInteractionChange: (interactionState) => options.onInteractionChange?.(interactionState),
    onIntent: (action) => {
      if (!animationQueue.isBlocking()) {
        options.onIntent?.(action);
      }
    },
    simulationRenderer,
  });
  addLighting(scene);

  const clock = new THREE.Clock();
  let animationFrameActive = false;

  const resize = () => {
    const width = sceneLayer.clientWidth || window.innerWidth;
    const height = sceneLayer.clientHeight || window.innerHeight;
    cameraRig.resize(width, height);
    renderer.setSize(width, height, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(sceneLayer);

  const render = () => {
    const delta = clock.getDelta();
    cameraRig.update(delta);
    board.update(delta);
    simulationRenderer.update(delta);
    const inputBlocked = animationQueue.isBlocking();

    if (inputBlocked !== latestInputBlocked) {
      latestInputBlocked = inputBlocked;
      options.onInputBlockedChange?.(inputBlocked);
      cardInteraction.refresh();
    }

    renderer.render(scene, cameraRig.camera);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const action = actionFromKeyboardEvent(event);

    if (!action) {
      return;
    }

    if (action.type === "toggle-debug") {
      event.preventDefault();
      debugFlags.debugCamera = cameraRig.toggleDebugMode();
      return;
    }

    if (action.type === "toggle-fast-animations") {
      event.preventDefault();
      debugFlags.fastAnimations = !debugFlags.fastAnimations;
      return;
    }

    if (!options.onIntent || animationQueue.isBlocking()) {
      return;
    }

    if (action.type === "pass-round" && latestState.phase === "playing") {
      event.preventDefault();
      options.onIntent({
        type: "pass-round",
        playerId: latestState.round.activePlayerId,
      });
    }

    if (action.type === "use-leader" && latestState.phase === "playing") {
      event.preventDefault();
      options.onIntent({
        type: "use-leader",
        playerId: latestState.round.activePlayerId,
      });
    }
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
  };
  const onContextRestored = () => {
    if (animationFrameActive) {
      renderer.setAnimationLoop(render);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
  resize();

  return {
    applyMatchState(state, applyOptions = {}) {
      latestState = state;
      simulationRenderer.applySnapshot(state, applyOptions);
      cardInteraction.refresh();
    },
    isInputBlocked() {
      return animationQueue.isBlocking();
    },
    setDebugCamera(enabled) {
      debugFlags.debugCamera = enabled;
      cameraRig.setDebugMode(enabled);
    },
    setFastAnimations(enabled) {
      debugFlags.fastAnimations = enabled;
    },
    setPlacementZones(enabled) {
      debugFlags.showPlacementZones = enabled;
      board.setPlacementZonesVisible(enabled);
    },
    start() {
      if (animationFrameActive) {
        return;
      }

      animationFrameActive = true;
      clock.start();
      renderer.setAnimationLoop(render);
    },
    dispose() {
      animationFrameActive = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("keydown", onKeyDown);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      resizeObserver.disconnect();
      cardInteraction.dispose();
      cameraRig.dispose();
      simulationRenderer.dispose();
      board.dispose();
      textureLoader.dispose();
      renderer.dispose();
      sceneLayer.remove();
    },
  };
}

function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#090806");
  scene.fog = new THREE.Fog("#090806", 18, 44);
  return scene;
}

function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function addLighting(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight("#f0dcc1", 0.58);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight("#ffe2b8", 2.9);
  keyLight.name = "KeyLight";
  keyLight.position.set(-4.5, 9.2, 6.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 28;
  keyLight.shadow.camera.left = -9;
  keyLight.shadow.camera.right = 9;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#8fb7ff", 1.05);
  rimLight.name = "RimLight";
  rimLight.position.set(5, 5, -8);
  scene.add(rimLight);

  const rowGlow = new THREE.PointLight("#b97b49", 18, 18, 2.1);
  rowGlow.name = "BoardRowGlow";
  rowGlow.position.set(0, 2.2, 0);
  scene.add(rowGlow);
}

function emitRendererAudioCue(cue: unknown) {
  window.dispatchEvent(new CustomEvent("oathbound:audio-cue", {
    detail: cue,
  }));
}

function createShell(root: HTMLElement): HTMLElement {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  root.appendChild(shell);
  return shell;
}
