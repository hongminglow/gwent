import type { RngState } from "./types";

const LCG_MODULUS = 0x100000000;
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;

export function createRng(seed: string): RngState {
  return {
    seed,
    value: hashSeed(seed),
  };
}

export function nextRandom(rng: RngState): { rng: RngState; value: number } {
  const nextValue = (Math.imul(rng.value, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;

  return {
    rng: {
      seed: rng.seed,
      value: nextValue,
    },
    value: nextValue / LCG_MODULUS,
  };
}

export function nextInt(rng: RngState, maxExclusive: number): { rng: RngState; value: number } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`maxExclusive must be a positive integer. Received: ${maxExclusive}`);
  }

  const next = nextRandom(rng);

  return {
    rng: next.rng,
    value: Math.floor(next.value * maxExclusive),
  };
}

export function shuffleWithRng<T>(rng: RngState, items: readonly T[]): { rng: RngState; items: T[] } {
  let nextRng = rng;
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = nextInt(nextRng, index + 1);
    nextRng = next.rng;
    [shuffled[index], shuffled[next.value]] = [shuffled[next.value], shuffled[index]];
  }

  return {
    rng: nextRng,
    items: shuffled,
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
