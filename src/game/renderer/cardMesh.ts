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
  hovered?: boolean;
  selected?: boolean;
  dragging?: boolean;
  rejected?: boolean;
};

const CARD_WIDTH = 1.42;
const CARD_HEIGHT = 2.05;
const CARD_THICKNESS = 0.065;

export function createCardMesh(options: CardMeshOptions): CardMesh {
  const root = new THREE.Group();
  const position = options.position ?? new THREE.Vector3();
  root.name = `CardMesh:${options.label}`;
  root.position.copy(position);
  root.rotation.set(-Math.PI / 2 + 0.06, options.rotationY ?? 0, 0);

  const faceTexture = options.frontTexture ?? createFaceTexture(options.label, options.accentColor, options.typeLabel);
  const captionTexture = createCaptionTexture(options.label, options.typeLabel);
  const powerTexture = createPowerTexture(options.powerLabel ?? "");
  const materials = createCardMaterialSet({
    accentColor: options.accentColor,
    faceColor: options.faceColor,
    captionTexture,
    frontTexture: faceTexture,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS),
    materials.body,
  );
  body.name = "CardBody";
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 1.84),
    materials.face,
  );
  face.name = "CardFace";
  face.position.z = 0.034;
  root.add(face);

  const frame = createCardFrame(options.accentColor);
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
    new THREE.PlaneGeometry(1.38, 1.96),
    highlightMaterial,
  );
  highlight.name = "CardInteractionHighlight";
  highlight.position.z = 0.04;
  highlight.visible = false;
  root.add(highlight);

  const gem = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 36),
    materials.accent,
  );
  gem.name = "CardPowerGem";
  gem.position.set(0, 0.68, 0.037);
  root.add(gem);

  const power = new THREE.Mesh(
    new THREE.PlaneGeometry(0.31, 0.2),
    new THREE.MeshBasicMaterial({
      map: powerTexture,
      transparent: true,
    }),
  );
  power.name = "CardPowerLabel";
  power.position.set(0, 0.68, 0.041);
  root.add(power);

  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.32),
    materials.caption,
  );
  caption.name = "CardCaption";
  caption.position.set(0, -0.62, 0.042);
  root.add(caption);

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
            : state.hovered
              ? 0.18
              : 0;

      highlight.visible = opacity > 0;
      highlightMaterial.opacity = opacity;
      highlightMaterial.color.set(state.rejected ? "#e55d4f" : state.dragging ? "#f0d290" : "#f8e6bb");
    },
    dispose() {
      if (!options.frontTexture) {
        faceTexture.dispose();
      }
      captionTexture.dispose();
      powerTexture.dispose();
      materials.dispose();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          disposeMeshMaterial(object.material);
        }
      });
    },
  };
}

function createCardFrame(accentColor: string): THREE.Group {
  const frame = new THREE.Group();
  frame.name = "CardFrame";
  const material = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.82,
  });
  const horizontalGeometry = new THREE.PlaneGeometry(1.18, 0.018);
  const verticalGeometry = new THREE.PlaneGeometry(0.018, 1.72);
  const top = new THREE.Mesh(horizontalGeometry, material);
  const bottom = new THREE.Mesh(horizontalGeometry.clone(), material);
  const left = new THREE.Mesh(verticalGeometry, material);
  const right = new THREE.Mesh(verticalGeometry.clone(), material);

  top.position.y = 0.86;
  bottom.position.y = -0.86;
  left.position.x = -0.59;
  right.position.x = 0.59;
  frame.add(top, bottom, left, right);

  return frame;
}

function createCaptionTexture(label: string, typeLabel?: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(createCaptionCanvas(label, typeLabel));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCaptionCanvas(label: string, typeLabel?: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card caption canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 8, 6, 0.9)";
  roundRect(context, 18, 16, 476, 96, 18);
  context.fill();
  context.strokeStyle = "rgba(247, 239, 225, 0.16)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#f7efe1";
  context.font = "800 31px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(label, canvas.width / 2, typeLabel ? 58 : 75, 432);

  if (typeLabel) {
    context.fillStyle = "rgba(242, 207, 123, 0.84)";
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(typeLabel, canvas.width / 2, 87, 420);
  }

  return canvas;
}

function createFaceTexture(label: string, accentColor: string, typeLabel?: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
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
  context.lineWidth = 12;
  roundRect(context, 34, 32, 444, 704, 28);
  context.stroke();

  context.globalAlpha = 0.22;
  context.fillStyle = accentColor;
  for (let index = 0; index < 9; index += 1) {
    const y = 108 + index * 64;
    context.beginPath();
    context.ellipse(256, y, 150 - index * 7, 26, 0.18, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.fillStyle = "rgba(247, 239, 225, 0.86)";
  context.font = "800 46px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  drawWrappedText(context, label, 256, 334, 370, 52, 3);

  if (typeLabel) {
    context.fillStyle = "rgba(242, 207, 123, 0.84)";
    context.font = "700 26px system-ui, sans-serif";
    context.fillText(typeLabel, 256, 510, 380);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPowerTexture(powerLabel: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 112;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card power canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (powerLabel) {
    context.fillStyle = "#fff8df";
    context.font = "900 62px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0, 0, 0, 0.75)";
    context.shadowBlur = 10;
    context.fillText(powerLabel, canvas.width / 2, canvas.height / 2 + 4, 130);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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

function disposeMeshMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(disposeMeshMaterial);
    return;
  }

  material.dispose();
}
