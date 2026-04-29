import * as THREE from "three";
import type { MatchPreviewState } from "../simulation/types";
import { createBoardScene } from "./boardScene";

export type ThreeApp = {
  start: () => void;
  dispose: () => void;
};

export function createThreeApp(root: HTMLElement, state: MatchPreviewState): ThreeApp {
  const shell = root.querySelector<HTMLElement>(".app-shell") ?? createShell(root);
  const sceneLayer = document.createElement("div");
  sceneLayer.className = "scene-layer";
  shell.prepend(sceneLayer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#090806");
  scene.fog = new THREE.Fog("#090806", 18, 42);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 8.6, 11.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sceneLayer.appendChild(renderer.domElement);

  const board = createBoardScene(state);
  scene.add(board.root);

  const ambientLight = new THREE.AmbientLight("#f0dcc1", 0.62);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight("#ffe2b8", 2.7);
  keyLight.position.set(-4.5, 9, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight("#8fb7ff", 1.1);
  rimLight.position.set(5, 5, -8);
  scene.add(rimLight);

  const clock = new THREE.Clock();
  let animationFrameActive = false;

  const resize = () => {
    const { clientWidth, clientHeight } = sceneLayer;
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const render = () => {
    const delta = clock.getDelta();
    board.update(delta);
    renderer.render(scene, camera);
  };

  window.addEventListener("resize", resize);
  resize();

  return {
    start() {
      if (animationFrameActive) {
        return;
      }

      animationFrameActive = true;
      renderer.setAnimationLoop(render);
    },
    dispose() {
      animationFrameActive = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      board.dispose();
      renderer.dispose();
      sceneLayer.remove();
    },
  };
}

function createShell(root: HTMLElement): HTMLElement {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  root.appendChild(shell);
  return shell;
}
