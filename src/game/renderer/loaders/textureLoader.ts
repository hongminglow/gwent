import * as THREE from "three";

export type GameTextureLoader = {
  loadTexture: (url: string) => THREE.Texture;
  getCachedTextureCount: () => number;
  dispose: () => void;
};

type TextureImageSource = CanvasImageSource & {
  height?: number;
  naturalHeight?: number;
  naturalWidth?: number;
  width?: number;
};

const MAX_CARD_TEXTURE_WIDTH = 512;
const MAX_CARD_TEXTURE_HEIGHT = 768;

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
          const originalImage = loadedTexture.image as TextureImageSource;
          const originalWidth = getImageWidth(originalImage);
          const originalHeight = getImageHeight(originalImage);
          loadedTexture.image = createCardTextureImage(originalImage);
          configureTexture(loadedTexture);
          loadedTexture.needsUpdate = true;

          if (import.meta.env.DEV) {
            const image = loadedTexture.image as TextureImageSource;
            console.info(
              `Loaded card art texture: ${url} (${originalWidth ?? "?"}x${originalHeight ?? "?"} -> ${
                getImageWidth(image) ?? "?"
              }x${getImageHeight(image) ?? "?"})`,
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

function createCardTextureImage(image: TextureImageSource): CanvasImageSource {
  const sourceWidth = getImageWidth(image);
  const sourceHeight = getImageHeight(image);

  if (
    !sourceWidth ||
    !sourceHeight ||
    (sourceWidth <= MAX_CARD_TEXTURE_WIDTH && sourceHeight <= MAX_CARD_TEXTURE_HEIGHT)
  ) {
    return image;
  }

  const scale = Math.min(MAX_CARD_TEXTURE_WIDTH / sourceWidth, MAX_CARD_TEXTURE_HEIGHT / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  if (!context) {
    return image;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return canvas;
}

function getImageWidth(image: TextureImageSource) {
  return image.naturalWidth ?? image.width;
}

function getImageHeight(image: TextureImageSource) {
  return image.naturalHeight ?? image.height;
}
