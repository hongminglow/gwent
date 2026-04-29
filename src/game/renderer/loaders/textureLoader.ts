import * as THREE from "three";

export type GameTextureLoader = {
  loadTexture: (url: string) => THREE.Texture;
  getCachedTextureCount: () => number;
  dispose: () => void;
};

export function createGameTextureLoader(renderer: THREE.WebGLRenderer): GameTextureLoader {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();

  return {
    loadTexture(url) {
      const cachedTexture = cache.get(url);

      if (cachedTexture) {
        return cachedTexture;
      }

      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(maxAnisotropy, 8);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      cache.set(url, texture);
      return texture;
    },
    getCachedTextureCount() {
      return cache.size;
    },
    dispose() {
      for (const texture of cache.values()) {
        texture.dispose();
      }

      cache.clear();
    },
  };
}
