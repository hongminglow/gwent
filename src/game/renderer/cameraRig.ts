import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CameraRig = {
  root: THREE.Group;
  camera: THREE.PerspectiveCamera;
  focusAt: (worldPosition: THREE.Vector3, intensity?: number, durationSeconds?: number) => void;
  isDebugMode: () => boolean;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => boolean;
  resize: (width: number, height: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 9.15, 12.55);
const TALL_CAMERA_POSITION = new THREE.Vector3(0, 9.8, 13.6);
const DEBUG_CAMERA_POSITION = new THREE.Vector3(0, 9.8, 13.2);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0.42);

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
  let viewportAspect = 1;
  const currentLookTarget = CAMERA_TARGET.clone();
  let focusPulse: {
    durationSeconds: number;
    elapsedSeconds: number;
    intensity: number;
    target: THREE.Vector3;
  } | undefined;
  const setDebugMode = (enabled: boolean) => {
    debugMode = enabled;
    controls.enabled = enabled;
    focusPulse = undefined;

    if (enabled) {
      camera.position.copy(DEBUG_CAMERA_POSITION);
    } else {
      camera.position.copy(getDefaultCameraPosition(viewportAspect));
    }

    controls.target.copy(CAMERA_TARGET);
    currentLookTarget.copy(CAMERA_TARGET);
    controls.update();
  };

  return {
    root,
    camera,
    focusAt(worldPosition, intensity = 0.8, durationSeconds = 0.72) {
      if (debugMode) {
        return;
      }

      focusPulse = {
        durationSeconds,
        elapsedSeconds: 0,
        intensity,
        target: worldPosition.clone(),
      };
    },
    isDebugMode() {
      return debugMode;
    },
    setDebugMode,
    toggleDebugMode() {
      setDebugMode(!debugMode);
      return debugMode;
    },
    resize(width, height) {
      viewportAspect = width / Math.max(height, 1);
      camera.aspect = viewportAspect;
      camera.fov = viewportAspect < 0.82 ? 48 : 42;
      camera.updateProjectionMatrix();
    },
    update(deltaSeconds) {
      elapsed += deltaSeconds;

      if (debugMode) {
        controls.update();
        return;
      }

      const breathe = Math.sin(elapsed * 0.35) * 0.08;
      const basePosition = getDefaultCameraPosition(viewportAspect);
      const cameraTargetPosition = new THREE.Vector3(
        basePosition.x,
        basePosition.y + breathe,
        basePosition.z,
      );
      const lookTarget = CAMERA_TARGET.clone();

      if (focusPulse) {
        focusPulse.elapsedSeconds += deltaSeconds;
        const progress = Math.min(focusPulse.elapsedSeconds / Math.max(focusPulse.durationSeconds, 0.001), 1);
        const pulse = easeInOutSine(Math.sin(progress * Math.PI)) * focusPulse.intensity;
        lookTarget.lerp(focusPulse.target, Math.min(pulse * 0.5, 0.54));
        cameraTargetPosition.x += focusPulse.target.x * pulse * 0.052;
        cameraTargetPosition.z -= pulse * 0.34;
        cameraTargetPosition.y -= pulse * 0.16;

        if (progress >= 1) {
          focusPulse = undefined;
        }
      }

      const alpha = Math.min(deltaSeconds * 4.2, 1);
      camera.position.lerp(cameraTargetPosition, alpha);
      currentLookTarget.lerp(lookTarget, Math.min(deltaSeconds * 5.4, 1));
      camera.lookAt(currentLookTarget);
    },
    dispose() {
      controls.dispose();
    },
  };
}

function getDefaultCameraPosition(aspect: number): THREE.Vector3 {
  if (aspect < 0.82) {
    return TALL_CAMERA_POSITION;
  }

  return DEFAULT_CAMERA_POSITION;
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}
