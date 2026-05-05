import * as THREE from "three";

export type GameTextureLoader = {
  loadTexture: (url: string) => THREE.Texture;
  getCachedTextureCount: () => number;
  dispose: () => void;
};

export function createGameTextureLoader(renderer: THREE.WebGLRenderer): GameTextureLoader {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const useMipmaps = renderer.capabilities.isWebGL2;
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, THREE.Texture>();

  const configureTexture = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(maxAnisotropy, 12);
    texture.generateMipmaps = useMipmaps;
    texture.minFilter = useMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  };

  return {
    loadTexture(rawUrl) {
      const url = rawUrl.trim();
      const cachedTexture = cache.get(url);

      if (cachedTexture) {
        return cachedTexture;
      }

      const texture = loader.load(
        url,
        (loadedTexture) => {
          configureTexture(loadedTexture);
          loadedTexture.needsUpdate = true;

          if (import.meta.env.DEV) {
            const image = loadedTexture.image as { naturalHeight?: number; naturalWidth?: number };
            console.info(
              `Loaded card art texture: ${url} (${image.naturalWidth ?? "?"}x${image.naturalHeight ?? "?"})`,
            );
          }
        },
        undefined,
        () => {
          console.warn(`Unable to load card art texture: ${url}`);
        },
      );
      configureTexture(texture);
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
