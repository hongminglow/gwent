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

      const texture = createFallbackTexture(url);
      loader.load(
        url,
        (loadedTexture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.anisotropy = Math.min(maxAnisotropy, 8);
          loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
          loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
          texture.image = loadedTexture.image;
          texture.needsUpdate = true;
          loadedTexture.dispose();
        },
        undefined,
        () => {
          console.warn(`Using fallback texture for missing asset: ${url}`);
        },
      );
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

function createFallbackTexture(url: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create fallback texture canvas.");
  }

  context.fillStyle = "#17130f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#f2cf7b";
  context.lineWidth = 8;
  context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  context.fillStyle = "rgba(242, 207, 123, 0.18)";
  for (let index = 0; index < 6; index += 1) {
    context.fillRect(38 + index * 24, 80 + index * 28, 112, 12);
  }
  context.fillStyle = "#f7efe1";
  context.font = "800 24px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("Missing Art", canvas.width / 2, 204);
  context.fillStyle = "rgba(226, 232, 226, 0.72)";
  context.font = "600 15px system-ui, sans-serif";
  context.fillText(getAssetName(url), canvas.width / 2, 232, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function getAssetName(url: string): string {
  return url.split("/").pop()?.split(".")[0] ?? "asset";
}
