import { describe, expect, it } from "vitest";
import { createVisualAnimationQueue } from "./animationQueue";
import type { GameEvent } from "../simulation/types";

describe("visual animation queue", () => {
  it("plays blocking animations in order and reports input blocking", () => {
    const queue = createVisualAnimationQueue();
    const played: string[] = [];

    queue.enqueue(createAnimation("first", true, played));
    queue.enqueue(createAnimation("second", false, played));

    expect(queue.isBlocking()).toBe(true);
    queue.update(0.05);
    expect(played).toEqual(["start:first"]);
    queue.update(0.1);
    expect(played).toEqual(["start:first", "complete:first"]);
    expect(queue.isBlocking()).toBe(false);
    queue.update(0.1);
    expect(played).toEqual(["start:first", "complete:first", "start:second", "complete:second"]);
    expect(queue.isBusy()).toBe(false);
  });
});

function createAnimation(id: string, blocking: boolean, played: string[]) {
  const event: GameEvent = {
    id,
    sequence: 1,
    type: "phase.changed",
    payload: {},
    blocking,
  };

  return {
    id,
    event,
    blocking,
    durationSeconds: 0.1,
    onStart: () => played.push(`start:${id}`),
    onComplete: () => played.push(`complete:${id}`),
  };
}
