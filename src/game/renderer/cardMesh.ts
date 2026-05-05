import * as THREE from "three";
import { createCardMaterialSet } from "./materials/cardMaterials";

export type CardMeshOptions = {
  label: string;
  accentColor: string;
  faceColor?: string;
  frontTexture?: THREE.Texture;
  position?: THREE.Vector3;
  rotationY?: number;
};

export type CardMesh = {
  root: THREE.Group;
  baseY: number;
  setDepthMode: (depthMode: CardDepthMode) => void;
  setRenderOrder: (renderOrder: number) => void;
  setInteractionState: (state: CardMeshInteractionState) => void;
  dispose: () => void;
};

export type CardDepthMode = "scene" | "handOverlay";

export type CardMeshInteractionState = {
  blockedTarget?: boolean;
  hovered?: boolean;
  selected?: boolean;
  dragging?: boolean;
  rejected?: boolean;
  validTarget?: boolean;
};

const CARD_WIDTH = 1.42;
const CARD_HEIGHT = 2.05;
const CARD_THICKNESS = 0.065;
const CARD_FRAME_LINE_WIDTH = 0.032;

type TextureCacheEntry = {
  refs: number;
  texture: THREE.CanvasTexture;
};

type TextureHandle = {
  release: () => void;
  texture: THREE.Texture;
};

const CARD_BODY_GEOMETRY = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS);
const CARD_FACE_GEOMETRY = new THREE.PlaneGeometry(1.34, 1.96);
const CARD_FRAME_HORIZONTAL_GEOMETRY = new THREE.PlaneGeometry(CARD_WIDTH - CARD_FRAME_LINE_WIDTH, CARD_FRAME_LINE_WIDTH);
const CARD_FRAME_VERTICAL_GEOMETRY = new THREE.PlaneGeometry(CARD_FRAME_LINE_WIDTH, CARD_HEIGHT - CARD_FRAME_LINE_WIDTH);
const CARD_HIGHLIGHT_GEOMETRY = new THREE.PlaneGeometry(1.38, 1.96);
export const CARD_RENDER_ORDER = 40;

const faceTextureCache = new Map<string, TextureCacheEntry>();

type ManagedMaterial = {
  handBlending: THREE.Blending;
  material: THREE.Material;
  sceneBlending: THREE.Blending;
  sceneDepthWrite: boolean;
  sceneTransparent: boolean;
};

export function createCardMesh(options: CardMeshOptions): CardMesh {
  const root = new THREE.Group();
  const position = options.position ?? new THREE.Vector3();
  root.name = `CardMesh:${options.label}`;
  root.renderOrder = CARD_RENDER_ORDER;
  root.position.copy(position);
  root.rotation.set(-Math.PI / 2 + 0.06, options.rotationY ?? 0, 0);

  const faceTexture = options.frontTexture
    ? createExternalTextureHandle(options.frontTexture)
    : acquireFaceTexture(options.label, options.accentColor);
  const materials = createCardMaterialSet({
    accentColor: options.accentColor,
    faceColor: options.faceColor,
    frontTexture: faceTexture.texture,
  });

  const body = new THREE.Mesh(
    CARD_BODY_GEOMETRY,
    materials.body,
  );
  body.name = "CardBody";
  body.castShadow = import.meta.env.DEV;
  body.receiveShadow = true;
  root.add(body);

  const face = new THREE.Mesh(
    CARD_FACE_GEOMETRY,
    materials.face,
  );
  face.name = "CardFace";
  face.position.z = 0.034;
  root.add(face);

  const frameMaterial = createCardFrameMaterial(options.accentColor);
  const frame = createCardFrame(frameMaterial);
  frame.position.z = 0.038;
  root.add(frame);

  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: "#f8e6bb",
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const highlight = new THREE.Mesh(
    CARD_HIGHLIGHT_GEOMETRY,
    highlightMaterial,
  );
  highlight.name = "CardInteractionHighlight";
  highlight.position.z = 0.04;
  highlight.visible = false;
  root.add(highlight);

  const managedMaterials: ManagedMaterial[] = [
    createManagedMaterial(materials.body, true, THREE.NoBlending),
    createManagedMaterial(materials.face, true, THREE.NoBlending),
    createManagedMaterial(materials.accent, true, THREE.NoBlending),
    createManagedMaterial(frameMaterial, true, THREE.NoBlending),
    createManagedMaterial(highlightMaterial, false, THREE.NormalBlending),
  ];

  applyCardRenderPriority(root, CARD_RENDER_ORDER);
  applyCardDepthMode(managedMaterials, "scene");

  return {
    root,
    baseY: position.y,
    setDepthMode(depthMode) {
      applyCardDepthMode(managedMaterials, depthMode);
    },
    setRenderOrder(renderOrder) {
      applyCardRenderPriority(root, renderOrder);
    },
    setInteractionState(state) {
      const opacity = state.rejected
        ? 0.38
        : state.dragging
          ? 0.34
          : state.selected
            ? 0.28
            : state.validTarget
              ? 0.3
              : state.blockedTarget
                ? 0.16
                : state.hovered
                  ? 0.18
                  : 0;

      highlight.visible = opacity > 0;
      highlightMaterial.opacity = opacity;
      highlightMaterial.color.set(
        state.rejected || state.blockedTarget
          ? "#e55d4f"
          : state.validTarget
            ? "#8dffce"
            : state.dragging
              ? "#f0d290"
              : "#f8e6bb",
      );
    },
    dispose() {
      faceTexture.release();
      materials.dispose();
      frameMaterial.dispose();
      highlightMaterial.dispose();
    },
  };
}

function applyCardRenderPriority(root: THREE.Group, renderOrder: number) {
  root.traverse((object) => {
    object.renderOrder = renderOrder;
  });
}

function applyCardDepthMode(materials: ManagedMaterial[], depthMode: CardDepthMode) {
  const isHandOverlay = depthMode === "handOverlay";

  for (const { handBlending, material, sceneBlending, sceneDepthWrite, sceneTransparent } of materials) {
    material.blending = isHandOverlay ? handBlending : sceneBlending;
    material.depthTest = !isHandOverlay;
    material.depthWrite = isHandOverlay ? false : sceneDepthWrite;
    material.transparent = isHandOverlay ? true : sceneTransparent;
    material.needsUpdate = true;
  }
}

function createManagedMaterial(
  material: THREE.Material,
  sceneDepthWrite: boolean,
  handBlending: THREE.Blending,
): ManagedMaterial {
  return {
    handBlending,
    material,
    sceneBlending: material.blending,
    sceneDepthWrite,
    sceneTransparent: material.transparent,
  };
}

function createCardFrameMaterial(accentColor: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: accentColor,
    depthWrite: true,
    toneMapped: false,
  });
}

function createCardFrame(material: THREE.MeshBasicMaterial): THREE.Group {
  const frame = new THREE.Group();
  frame.name = "CardFrame";
  const top = new THREE.Mesh(CARD_FRAME_HORIZONTAL_GEOMETRY, material);
  const bottom = new THREE.Mesh(CARD_FRAME_HORIZONTAL_GEOMETRY, material);
  const left = new THREE.Mesh(CARD_FRAME_VERTICAL_GEOMETRY, material);
  const right = new THREE.Mesh(CARD_FRAME_VERTICAL_GEOMETRY, material);

  top.position.y = CARD_HEIGHT / 2 - CARD_FRAME_LINE_WIDTH / 2;
  bottom.position.y = -CARD_HEIGHT / 2 + CARD_FRAME_LINE_WIDTH / 2;
  left.position.x = -CARD_WIDTH / 2 + CARD_FRAME_LINE_WIDTH / 2;
  right.position.x = CARD_WIDTH / 2 - CARD_FRAME_LINE_WIDTH / 2;
  frame.add(top, bottom, left, right);

  return frame;
}

function createExternalTextureHandle(texture: THREE.Texture): TextureHandle {
  return {
    texture,
    release() {
      return undefined;
    },
  };
}

function acquireFaceTexture(label: string, accentColor: string): TextureHandle {
  return acquireCachedTexture(
    faceTextureCache,
    `${label}|${accentColor}`,
    () => createFaceTexture(label, accentColor),
  );
}

function acquireCachedTexture(
  cache: Map<string, TextureCacheEntry>,
  key: string,
  createTexture: () => THREE.CanvasTexture,
): TextureHandle {
  const cached = cache.get(key);

  if (cached) {
    cached.refs += 1;
    return {
      texture: cached.texture,
      release: () => releaseCachedTexture(cache, key),
    };
  }

  const texture = createTexture();
  cache.set(key, {
    refs: 1,
    texture,
  });

  return {
    texture,
    release: () => releaseCachedTexture(cache, key),
  };
}

function releaseCachedTexture(cache: Map<string, TextureCacheEntry>, key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return;
  }

  cached.refs -= 1;

  if (cached.refs <= 0) {
    cached.texture.dispose();
    cache.delete(key);
  }
}

function createFaceTexture(label: string, accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 576;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card face canvas.");
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#352416");
  gradient.addColorStop(0.42, "#191613");
  gradient.addColorStop(1, "#0b0a08");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = accentColor;
  context.lineWidth = 9;
  roundRect(context, 26, 24, 332, 528, 22);
  context.stroke();

  context.globalAlpha = 0.22;
  context.fillStyle = accentColor;
  for (let index = 0; index < 9; index += 1) {
    const y = 80 + index * 48;
    context.beginPath();
    context.ellipse(192, y, 112 - index * 5, 20, 0.18, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
