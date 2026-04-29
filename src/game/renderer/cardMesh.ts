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
  dispose: () => void;
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

  const captionTexture = createCaptionTexture(options.label);
  const materials = createCardMaterialSet({
    accentColor: options.accentColor,
    faceColor: options.faceColor,
    captionTexture,
    frontTexture: options.frontTexture,
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

  const gem = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 32),
    materials.accent,
  );
  gem.name = "CardPowerGem";
  gem.position.set(0, 0.68, 0.037);
  root.add(gem);

  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.28),
    materials.caption,
  );
  caption.name = "CardCaption";
  caption.position.set(0, -0.62, 0.039);
  root.add(caption);

  return {
    root,
    baseY: position.y,
    dispose() {
      captionTexture.dispose();
      materials.dispose();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
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
    opacity: 0.72,
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

function createCaptionTexture(label: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(createCaptionCanvas(label));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCaptionCanvas(label: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create card caption canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(10, 8, 6, 0.82)";
  roundRect(context, 18, 22, 476, 84, 18);
  context.fill();
  context.fillStyle = "#f7efe1";
  context.font = "700 38px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2, 430);

  return canvas;
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
