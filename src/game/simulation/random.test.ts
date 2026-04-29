import { describe, expect, it } from "vitest";
import { createRng, nextInt, shuffleWithRng } from "./random";

describe("deterministic rng", () => {
  it("produces the same integer sequence for the same seed", () => {
    let first = createRng("same-seed");
    let second = createRng("same-seed");
    const firstValues: number[] = [];
    const secondValues: number[] = [];

    for (let index = 0; index < 8; index += 1) {
      const firstNext = nextInt(first, 1000);
      const secondNext = nextInt(second, 1000);
      first = firstNext.rng;
      second = secondNext.rng;
      firstValues.push(firstNext.value);
      secondValues.push(secondNext.value);
    }

    expect(firstValues).toEqual(secondValues);
  });

  it("shuffles without mutating the source array", () => {
    const source = ["a", "b", "c", "d", "e"];
    const first = shuffleWithRng(createRng("shuffle-seed"), source);
    const second = shuffleWithRng(createRng("shuffle-seed"), source);

    expect(source).toEqual(["a", "b", "c", "d", "e"]);
    expect(first.items).toEqual(second.items);
    expect(first.items).not.toBe(source);
  });
});
