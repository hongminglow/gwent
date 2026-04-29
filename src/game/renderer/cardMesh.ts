import * as THREE from "three";

export type CardMeshOptions = {
  label: string;
  accentColor: string;
  position: THREE.Vector3;
  rotationY: number;
};

export type CardMesh = {
  root: THREE.Group;
  baseY: number;
};

export function createCardMesh(options: CardMeshOptions): CardMesh {
  const root = new THREE.Group();
  root.position.copy(options.position);
  root.rotation.set(-Math.PI / 2 + 0.06, options.rotationY, 0);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 2.05, 0.06),
    new THREE.MeshStandardMaterial({
      color: "#241912",
      roughness: 0.55,
      metalness: 0.12,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 1.84),
    new THREE.MeshStandardMaterial({
      color: "#3b2a1d",
      emissive: options.accentColor,
      emissiveIntensity: 0.13,
      roughness: 0.68,
      metalness: 0.05,
    }),
  );
  face.position.z = 0.034;
  root.add(face);

  const gem = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 32),
    new THREE.MeshStandardMaterial({
      color: options.accentColor,
      emissive: options.accentColor,
      emissiveIntensity: 0.32,
      roughness: 0.45,
      metalness: 0.22,
    }),
  );
  gem.position.set(0, 0.68, 0.037);
  root.add(gem);

  const captionCanvas = createCaptionCanvas(options.label);
  const captionTexture = new THREE.CanvasTexture(captionCanvas);
  captionTexture.colorSpace = THREE.SRGBColorSpace;

  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.28),
    new THREE.MeshBasicMaterial({
      map: captionTexture,
      transparent: true,
    }),
  );
  caption.position.set(0, -0.62, 0.039);
  root.add(caption);

  return {
    root,
    baseY: options.position.y,
  };
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
