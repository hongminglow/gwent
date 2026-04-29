import { debugFlags } from "../diagnostics/debugFlags";
import type { GameEvent } from "../simulation/types";

export type VisualAnimation = {
  id: string;
  event: GameEvent;
  blocking: boolean;
  durationSeconds: number;
  onStart?: () => void;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
};

export type VisualAnimationQueue = {
  enqueue: (animation: VisualAnimation) => void;
  clear: () => void;
  update: (deltaSeconds: number) => void;
  isBlocking: () => boolean;
  isBusy: () => boolean;
  getQueuedCount: () => number;
};

export function createVisualAnimationQueue(): VisualAnimationQueue {
  const queuedAnimations: VisualAnimation[] = [];
  let activeAnimation: VisualAnimation | undefined;
  let activeElapsed = 0;

  return {
    enqueue(animation) {
      queuedAnimations.push(animation);
    },
    clear() {
      queuedAnimations.length = 0;
      activeAnimation?.onComplete?.();
      activeAnimation = undefined;
      activeElapsed = 0;
    },
    update(deltaSeconds) {
      if (!activeAnimation) {
        activeAnimation = queuedAnimations.shift();
        activeElapsed = 0;
        activeAnimation?.onStart?.();
      }

      if (!activeAnimation) {
        return;
      }

      const duration = debugFlags.fastAnimations
        ? Math.min(activeAnimation.durationSeconds, 0.05)
        : activeAnimation.durationSeconds;
      activeElapsed += deltaSeconds;
      const progress = duration <= 0 ? 1 : Math.min(activeElapsed / duration, 1);
      activeAnimation.onUpdate?.(easeOutCubic(progress));

      if (progress < 1) {
        return;
      }

      activeAnimation.onComplete?.();
      activeAnimation = undefined;
      activeElapsed = 0;
    },
    isBlocking() {
      return Boolean(activeAnimation?.blocking) || queuedAnimations.some((animation) => animation.blocking);
    },
    isBusy() {
      return Boolean(activeAnimation) || queuedAnimations.length > 0;
    },
    getQueuedCount() {
      return queuedAnimations.length + (activeAnimation ? 1 : 0);
    },
  };
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}
