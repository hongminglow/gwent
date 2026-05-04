import * as THREE from "three";

export type CardMaterialOptions = {
  accentColor: string;
  faceColor?: string;
  captionTexture?: THREE.Texture;
  frontTexture?: THREE.Texture;
};

export type CardMaterialSet = {
  body: THREE.MeshStandardMaterial;
  face: THREE.MeshBasicMaterial;
  accent: THREE.MeshStandardMaterial;
  caption: THREE.MeshBasicMaterial;
  dispose: () => void;
};

export function createCardMaterialSet(options: CardMaterialOptions): CardMaterialSet {
  const body = new THREE.MeshStandardMaterial({
    color: "#2a1d14",
    roughness: 0.5,
    metalness: 0.18,
    envMapIntensity: 0.6,
  });
  const face = new THREE.MeshBasicMaterial({
    color: options.faceColor ?? "#3b2a1d",
    map: options.frontTexture,
    toneMapped: false,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: options.accentColor,
    emissive: options.accentColor,
    emissiveIntensity: 0.42,
    roughness: 0.36,
    metalness: 0.32,
    envMapIntensity: 0.72,
  });
  const caption = new THREE.MeshBasicMaterial({
    map: options.captionTexture,
    transparent: true,
    opacity: options.captionTexture ? 1 : 0,
  });

  return {
    body,
    face,
    accent,
    caption,
    dispose() {
      body.dispose();
      face.dispose();
      accent.dispose();
      caption.dispose();
    },
  };
}
