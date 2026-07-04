import { useEffect, useRef, useState } from "react";
import { getFrameTickDuration, TICK_INTERVAL_MS } from "../animations/beyondBirthday";
import type {
  AnimationDefinition,
  CompanionAction,
  FacingDirection,
  GrabbedLeanTier,
} from "../animations/types";
import {
  getInitialWalkStep,
  getWalkFrameIndex,
} from "../animations/walkPlayback";
import type { AnimationRegistry } from "../services/animationRegistry";

interface UseCompanionAnimationOptions {
  registry: AnimationRegistry;
  action: CompanionAction;
  facing: FacingDirection;
  grabbedLeanTier?: GrabbedLeanTier;
  onTick?: (deltaX: number) => void;
  onClimbTick?: (deltaY: number) => void;
  onAnimationCycleComplete?: (action: CompanionAction) => void;
}

interface UseCompanionAnimationResult {
  frameSrc: string;
}

function advanceFrameIndex(
  animation: AnimationDefinition,
  currentIndex: number,
): number {
  return (currentIndex + 1) % animation.frames.length;
}

function usesShimejiCycle(
  action: CompanionAction,
  usesShimejiPlayback: boolean,
): boolean {
  return (
    usesShimejiPlayback &&
    (action === "walk" ||
      action === "climbWall" ||
      action === "climbWallDown")
  );
}

function initialFrameIndex(
  action: CompanionAction,
  frameCount: number,
  usesShimejiPlayback: boolean,
): number {
  if (usesShimejiCycle(action, usesShimejiPlayback)) {
    return getWalkFrameIndex(getInitialWalkStep(), frameCount);
  }

  // sequential imports: climbing down starts on frame 2, then loops in order
  if (action === "climbWallDown" && frameCount >= 2) {
    return 1;
  }

  return 0;
}

export function useCompanionAnimation({
  registry,
  action,
  facing,
  grabbedLeanTier = "lightLeft",
  onTick,
  onClimbTick,
  onAnimationCycleComplete,
}: UseCompanionAnimationOptions): UseCompanionAnimationResult {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameIndexRef = useRef(0);
  const walkStepRef = useRef(0);
  const frameShownAtRef = useRef(performance.now());
  const actionRef = useRef(action);
  const facingRef = useRef(facing);
  const registryRef = useRef(registry);
  const onTickRef = useRef(onTick);
  const onClimbTickRef = useRef(onClimbTick);
  const onAnimationCycleCompleteRef = useRef(onAnimationCycleComplete);

  useEffect(() => {
    actionRef.current = action;
    facingRef.current = facing;
    registryRef.current = registry;
  }, [action, facing, registry]);

  useEffect(() => {
    onTickRef.current = onTick;
    onClimbTickRef.current = onClimbTick;
    onAnimationCycleCompleteRef.current = onAnimationCycleComplete;
  }, [onAnimationCycleComplete, onClimbTick, onTick]);

  useEffect(() => {
    const animation = registryRef.current.getAnimation(action);
    const frameCount = animation.frames.length;
    const usesShimejiPlayback = registryRef.current.playbackStyle === "shimeji";

    walkStepRef.current = usesShimejiCycle(action, usesShimejiPlayback)
      ? getInitialWalkStep()
      : 0;
    frameIndexRef.current = initialFrameIndex(
      action,
      frameCount,
      usesShimejiPlayback,
    );
    frameShownAtRef.current = performance.now();
    setFrameIndex(frameIndexRef.current);
  }, [action]);

  useEffect(() => {
    const currentAction = actionRef.current;

    if (currentAction === "grabbed" || currentAction === "fall") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const activeAction = actionRef.current;
      const animation = registryRef.current.getAnimation(activeAction);
      const usesShimejiPlayback =
        registryRef.current.playbackStyle === "shimeji";
      const directionMultiplier = facingRef.current === "right" ? -1 : 1;

      if (
        (activeAction === "walk" ||
          activeAction === "floorCrawl" ||
          activeAction === "climbCeiling") &&
        onTickRef.current
      ) {
        onTickRef.current(animation.velocity.x * directionMultiplier);
      }

      if (
        (activeAction === "climbWall" || activeAction === "climbWallDown") &&
        onClimbTickRef.current
      ) {
        onClimbTickRef.current(animation.velocity.y);
      }

      const frameDurationMs =
        getFrameTickDuration(animation, frameIndexRef.current) *
        TICK_INTERVAL_MS;

      if (performance.now() - frameShownAtRef.current < frameDurationMs) {
        return;
      }

      frameShownAtRef.current = performance.now();

      if (
        activeAction === "bounce" ||
        activeAction === "emote" ||
        activeAction === "emote2" ||
        activeAction === "emote3" ||
        activeAction === "emote4" ||
        activeAction === "emote5" ||
        activeAction === "emote6"
      ) {
        const nextIndex = frameIndexRef.current + 1;

        if (nextIndex >= animation.frames.length) {
          onAnimationCycleCompleteRef.current?.(activeAction);
          frameIndexRef.current = 0;
          setFrameIndex(0);
          return;
        }

        frameIndexRef.current = nextIndex;
        setFrameIndex(nextIndex);
        return;
      }

      if (usesShimejiCycle(activeAction, usesShimejiPlayback)) {
        walkStepRef.current += 1;
        const nextIndex = getWalkFrameIndex(
          walkStepRef.current,
          animation.frames.length,
        );
        frameIndexRef.current = nextIndex;
        setFrameIndex(nextIndex);
        return;
      }

      const nextIndex = advanceFrameIndex(animation, frameIndexRef.current);
      frameIndexRef.current = nextIndex;
      setFrameIndex(nextIndex);
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [action]);

  if (action === "grabbed") {
    return {
      frameSrc: registry.getGrabbedLeanFrame(grabbedLeanTier),
    };
  }

  const animation = registry.getAnimation(action);
  const frame = animation.frames[frameIndex] ?? animation.frames[0];

  return {
    // registry frames are already resolved urls
    frameSrc: frame,
  };
}
