import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CameraRig = {
  root: THREE.Group;
  camera: THREE.PerspectiveCamera;
  isDebugMode: () => boolean;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => boolean;
  resize: (width: number, height: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 8.8, 11.8);
const DEBUG_CAMERA_POSITION = new THREE.Vector3(0, 9.8, 13.2);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export function createCameraRig(domElement: HTMLElement): CameraRig {
  const root = new THREE.Group();
  root.name = "CameraRig";

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  camera.lookAt(CAMERA_TARGET);
  root.add(camera);

  const controls = new OrbitControls(camera, domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6.8;
  controls.maxDistance = 21;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.target.copy(CAMERA_TARGET);
  controls.update();

  let debugMode = false;
  let elapsed = 0;
  const setDebugMode = (enabled: boolean) => {
    debugMode = enabled;
    controls.enabled = enabled;

    if (enabled) {
      camera.position.copy(DEBUG_CAMERA_POSITION);
    } else {
      camera.position.copy(DEFAULT_CAMERA_POSITION);
    }

    controls.target.copy(CAMERA_TARGET);
    controls.update();
  };

  return {
    root,
    camera,
    isDebugMode() {
      return debugMode;
    },
    setDebugMode,
    toggleDebugMode() {
      setDebugMode(!debugMode);
      return debugMode;
    },
    resize(width, height) {
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    },
    update(deltaSeconds) {
      elapsed += deltaSeconds;

      if (debugMode) {
        controls.update();
        return;
      }

      const breathe = Math.sin(elapsed * 0.35) * 0.08;
      camera.position.lerp(
        new THREE.Vector3(DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.y + breathe, DEFAULT_CAMERA_POSITION.z),
        0.035,
      );
      camera.lookAt(CAMERA_TARGET);
    },
    dispose() {
      controls.dispose();
    },
  };
}
