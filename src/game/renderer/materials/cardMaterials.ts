import * as THREE from "three";

export type CardMaterialOptions = {
  accentColor: string;
  faceColor?: string;
  captionTexture?: THREE.Texture;
  frontTexture?: THREE.Texture;
};

export type CardMaterialSet = {
  body: THREE.MeshStandardMaterial;
  face: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  caption: THREE.MeshBasicMaterial;
  dispose: () => void;
};

export function createCardMaterialSet(options: CardMaterialOptions): CardMaterialSet {
  const body = new THREE.MeshStandardMaterial({
    color: "#241912",
    roughness: 0.58,
    metalness: 0.14,
  });
  const face = new THREE.MeshStandardMaterial({
    color: options.faceColor ?? "#3b2a1d",
    emissive: options.accentColor,
    emissiveIntensity: 0.13,
    map: options.frontTexture,
    roughness: 0.67,
    metalness: 0.05,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: options.accentColor,
    emissive: options.accentColor,
    emissiveIntensity: 0.34,
    roughness: 0.45,
    metalness: 0.24,
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
