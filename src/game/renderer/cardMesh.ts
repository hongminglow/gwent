import * as THREE from "three";
import { createCardMaterialSet } from "./materials/cardMaterials";

export type CardMeshOptions = {
  label: string;
  accentColor: string;
  faceColor?: string;
  frontTexture?: THREE.Texture;
  powerLabel?: string;
  position?: THREE.Vector3;
  rotationY?: number;
  typeLabel?: string;
};

export type CardMesh = {
  root: THREE.Group;
  baseY: number;
  setInteractionState: (state: CardMeshInteractionState) => void;
  dispose: () => void;
};

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

type TextureCacheEntry = {
  refs: number;
  texture: THREE.CanvasTexture;
};

type TextureHandle = {
  release: () => void;
  texture: THREE.Texture;
};

const CARD_BODY_GEOMETRY = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS);
const CARD_FACE_GEOMETRY = new THREE.PlaneGeometry(1.26, 1.84);
const CARD_FRAME_HORIZONTAL_GEOMETRY = new THREE.PlaneGeometry(1.18, 0.018);
const CARD_FRAME_VERTICAL_GEOMETRY = new THREE.PlaneGeometry(0.018, 1.72);
const CARD_HIGHLIGHT_GEOMETRY = new THREE.PlaneGeometry(1.38, 1.96);
const CARD_POWER_GEM_GEOMETRY = new THREE.CircleGeometry(0.18, 28);
const CARD_POWER_LABEL_GEOMETRY = new THREE.PlaneGeometry(0.31, 0.2);
const CARD_CAPTION_GEOMETRY = new THREE.PlaneGeometry(1.12, 0.32);
const CARD_RENDER_ORDER = 40;

const faceTextureCache = new Map<string, TextureCacheEntry>();
const captionTextureCache = new Map<string, TextureCacheEntry>();
const powerTextureCache = new Map<string, TextureCacheEntry>();

export function createCardMesh(options: CardMeshOptions): CardMesh {
  const root = new THREE.Group();
  const position = options.position ?? new THREE.Vector3();
  root.name = `CardMesh:${options.label}`;
  root.renderOrder = CARD_RENDER_ORDER;
  root.position.copy(position);
  root.rotation.set(-Math.PI / 2 + 0.06, options.rotationY ?? 0, 0);

  const faceTexture = options.frontTexture
    ? createExternalTextureHandle(options.frontTexture)
    : acquireFaceTexture(options.label, options.accentColor, options.typeLabel);
  const captionTexture = acquireCaptionTexture(options.label, options.typeLabel);
  const powerTexture = acquirePowerTexture(options.powerLabel ?? "");
  const materials = createCardMaterialSet({
    accentColor: options.accentColor,
    faceColor: options.faceColor,
    captionTexture: captionTexture.texture,
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

  const gem = new THREE.Mesh(
    CARD_POWER_GEM_GEOMETRY,
    materials.accent,
  );
  gem.name = "CardPowerGem";
  gem.position.set(0, 0.68, 0.037);
  root.add(gem);

  const powerMaterial = new THREE.MeshBasicMaterial({
    map: powerTexture.texture,
    transparent: true,
  });
  const power = new THREE.Mesh(
    CARD_POWER_LABEL_GEOMETRY,
    powerMaterial,
  );
  power.name = "CardPowerLabel";
  power.position.set(0, 0.68, 0.041);
  root.add(power);

  const caption = new THREE.Mesh(
    CARD_CAPTION_GEOMETRY,
    materials.caption,
  );
  caption.name = "CardCaption";
  caption.position.set(0, -0.62, 0.042);
  root.add(caption);
  applyCardRenderPriority(root);

  return {
    root,
    baseY: position.y,
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
      captionTexture.release();
      powerTexture.release();
      materials.dispose();
      frameMaterial.dispose();
      highlightMaterial.dispose();
      powerMaterial.dispose();
    },
  };
}

function applyCardRenderPriority(root: THREE.Group) {
  root.traverse((object) => {
    object.renderOrder = CARD_RENDER_ORDER;
  });
}

function createCardFrameMaterial(accentColor: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.82,
  });
}

function createCardFrame(material: THREE.MeshBasicMaterial): THREE.Group {
  const frame = new THREE.Group();
  frame.name = "CardFrame";
  const top = new THREE.Mesh(CARD_FRAME_HORIZONTAL_GEOMETRY, material);
  const bottom = new THREE.Mesh(CARD_FRAME_HORIZONTAL_GEOMETRY, material);
  const left = new THREE.Mesh(CARD_FRAME_VERTICAL_GEOMETRY, material);
  const right = new THREE.Mesh(CARD_FRAME_VERTICAL_GEOMETRY, material);

  top.position.y = 0.86;
  bottom.position.y = -0.86;
  left.position.x = -0.59;
  right.position.x = 0.59;
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

function acquireFaceTexture(label: string, accentColor: string, typeLabel?: string): TextureHandle {
  return acquireCachedTexture(
    faceTextureCache,
    `${label}|${accentColor}|${typeLabel ?? ""}`,
    () => createFaceTexture(label, accentColor, typeLabel),
  );
}

function acquireCaptionTexture(label: string, typeLabel?: string): TextureHandle {
  return acquireCachedTexture(
    captionTextureCache,
    `${label}|${typeLabel ?? ""}`,
    () => createCaptionTexture(label, typeLabel),
  );
}

function acquirePowerTexture(powerLabel: string): TextureHandle {
  return acquireCachedTexture(
    powerTextureCache,
    powerLabel,
    () => createPowerTexture(powerLabel),
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

function createCaptionTexture(label: string, typeLabel?: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(createCaptionCanvas(label, typeLabel));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function createCaptionCanvas(label: string, typeLabel?: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card caption canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 8, 6, 0.9)";
  roundRect(context, 12, 12, 360, 72, 14);
  context.fill();
  context.strokeStyle = "rgba(247, 239, 225, 0.16)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#f7efe1";
  context.font = "800 23px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(label, canvas.width / 2, typeLabel ? 44 : 56, 324);

  if (typeLabel) {
    context.fillStyle = "rgba(242, 207, 123, 0.84)";
    context.font = "700 14px system-ui, sans-serif";
    context.fillText(typeLabel, canvas.width / 2, 66, 316);
  }

  return canvas;
}

function createFaceTexture(label: string, accentColor: string, typeLabel?: string): THREE.CanvasTexture {
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

  context.fillStyle = "rgba(247, 239, 225, 0.86)";
  context.font = "800 34px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  drawWrappedText(context, label, 192, 250, 276, 39, 3);

  if (typeLabel) {
    context.fillStyle = "rgba(242, 207, 123, 0.84)";
    context.font = "700 20px system-ui, sans-serif";
    context.fillText(typeLabel, 192, 382, 285);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createPowerTexture(powerLabel: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 90;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card power canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (powerLabel) {
    context.fillStyle = "#fff8df";
    context.font = "900 50px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0, 0, 0, 0.75)";
    context.shadowBlur = 8;
    context.fillText(powerLabel, canvas.width / 2, canvas.height / 2 + 3, 104);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || line.length === 0) {
      line = nextLine;
      continue;
    }

    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (line) {
    lines.push(line);
  }

  const visibleLines = lines.slice(0, maxLines);
  const startY = y - ((visibleLines.length - 1) * lineHeight) / 2;

  visibleLines.forEach((visibleLine, index) => {
    context.fillText(visibleLine, x, startY + index * lineHeight, maxWidth);
  });
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
