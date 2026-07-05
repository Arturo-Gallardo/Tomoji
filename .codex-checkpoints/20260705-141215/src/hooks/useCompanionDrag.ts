import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveGrabbedLeanTier,
  TICK_INTERVAL_MS,
} from "../animations/beyondBirthday";
import type { GrabbedLeanTier } from "../animations/types";
import type {
  AnchorClampMode,
  DragOffset,
  FallVelocity,
  ScreenPosition,
} from "../types/companion";
import { toPhysicalScreenPosition } from "../utils/screenCoordinates";

const RESIST_DURATION_MS = 200;
const VELOCITY_SAMPLE_COUNT = 3;
const VELOCITY_EMA_ALPHA = 0.25;

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

function computeVelocityX(samples: PointerSample[]): number {
  if (samples.length < 2) {
    return 0;
  }

  const recent = samples.slice(-VELOCITY_SAMPLE_COUNT);
  let totalVelocity = 0;
  let count = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const current = recent[index];
    const previous = recent[index - 1];
    const deltaTime = Math.max(current.time - previous.time, 1);

    totalVelocity += ((current.x - previous.x) / deltaTime) * TICK_INTERVAL_MS;
    count += 1;
  }

  return count > 0 ? totalVelocity / count : 0;
}

interface UseCompanionDragOptions {
  isEnabled: boolean;
  skipResistDelay: boolean;
  grabOffset: DragOffset;
  getAnchorPosition: () => ScreenPosition;
  setAnchorPosition: (
    position: ScreenPosition,
    mode?: AnchorClampMode,
  ) => Promise<void>;
  onDragStart: () => void;
  onResistEnd: () => void;
  onDragMove?: (anchor: ScreenPosition) => void;
  onDragEnd: (options: { throwVelocity: FallVelocity; anchor: ScreenPosition }) => void;
}

interface UseCompanionDragResult {
  isDragging: boolean;
  grabbedLeanTier: GrabbedLeanTier;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

export function useCompanionDrag({
  isEnabled,
  skipResistDelay,
  grabOffset,
  getAnchorPosition,
  setAnchorPosition,
  onDragStart,
  onResistEnd,
  onDragMove,
  onDragEnd,
}: UseCompanionDragOptions): UseCompanionDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const [grabbedLeanTier, setGrabbedLeanTier] =
    useState<GrabbedLeanTier>("lightLeft");

  const isDraggingRef = useRef(false);
  const leanTierRef = useRef<GrabbedLeanTier>("lightLeft");
  const smoothedVelocityRef = useRef(0);
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 });
  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const activePointerIdRef = useRef<number | null>(null);
  const captureElementRef = useRef<HTMLElement | null>(null);
  const resistTimeoutRef = useRef<number | null>(null);
  const skipResistDelayRef = useRef(skipResistDelay);

  const onDragStartRef = useRef(onDragStart);
  const onResistEndRef = useRef(onResistEnd);
  const onDragEndRef = useRef(onDragEnd);
  const onDragMoveRef = useRef(onDragMove);

  useEffect(() => {
    skipResistDelayRef.current = skipResistDelay;
  }, [skipResistDelay]);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onResistEndRef.current = onResistEnd;
    onDragMoveRef.current = onDragMove;
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd, onDragMove, onDragStart, onResistEnd]);

  const clearResistTimeout = useCallback(() => {
    if (resistTimeoutRef.current !== null) {
      window.clearTimeout(resistTimeoutRef.current);
      resistTimeoutRef.current = null;
    }
  }, []);

  const resetLeanState = useCallback(() => {
    leanTierRef.current = "lightLeft";
    smoothedVelocityRef.current = 0;
    setGrabbedLeanTier("lightLeft");
  }, []);

  const updateLeanFromVelocity = useCallback((rawVelocityX: number) => {
    const smoothed =
      smoothedVelocityRef.current * (1 - VELOCITY_EMA_ALPHA) +
      rawVelocityX * VELOCITY_EMA_ALPHA;
    smoothedVelocityRef.current = smoothed;

    leanTierRef.current = resolveGrabbedLeanTier(leanTierRef.current, smoothed);
    setGrabbedLeanTier(leanTierRef.current);
  }, []);

  const finishDrag = useCallback(
    (_event: PointerEvent) => {
      if (!isDraggingRef.current) {
        return;
      }

      isDraggingRef.current = false;
      setIsDragging(false);
      resetLeanState();
      clearResistTimeout();

      const samples = pointerSamplesRef.current;
      pointerSamplesRef.current = [];

      const throwVelocity: FallVelocity = {
        x: computeVelocityX(samples),
        y: 0,
      };

      if (samples.length >= 2) {
        const last = samples[samples.length - 1];
        const previous = samples[samples.length - 2];
        const deltaTime = Math.max(last.time - previous.time, 1);

        throwVelocity.y = ((last.y - previous.y) / deltaTime) * TICK_INTERVAL_MS;
      }

      onDragEndRef.current({
        throwVelocity,
        anchor: getAnchorPosition(),
      });

      const captureElement = captureElementRef.current;
      const pointerId = activePointerIdRef.current;

      if (captureElement && pointerId !== null) {
        try {
          captureElement.releasePointerCapture(pointerId);
        } catch {
          // pointer already released
        }
      }

      captureElementRef.current = null;
      activePointerIdRef.current = null;
    },
    [clearResistTimeout, getAnchorPosition, resetLeanState],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (
        !isDraggingRef.current ||
        activePointerIdRef.current !== event.pointerId
      ) {
        return;
      }

      const pointer = toPhysicalScreenPosition(event.screenX, event.screenY);
      const sample: PointerSample = {
        x: pointer.x,
        y: pointer.y,
        time: event.timeStamp,
      };

      pointerSamplesRef.current.push(sample);
      if (pointerSamplesRef.current.length > 6) {
        pointerSamplesRef.current.shift();
      }

      const velocityX = computeVelocityX(pointerSamplesRef.current);
      const offset = dragOffsetRef.current;
      const nextPosition: ScreenPosition = {
        x: pointer.x + offset.x,
        y: pointer.y + offset.y,
      };

      updateLeanFromVelocity(velocityX);
      void setAnchorPosition(nextPosition, "walls");
      onDragMoveRef.current?.(getAnchorPosition());
    },
    [getAnchorPosition, setAnchorPosition, updateLeanFromVelocity],
  );

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      clearResistTimeout();
    };
  }, [clearResistTimeout, finishDrag, handlePointerMove]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isEnabled || event.button !== 0) {
        return;
      }

      event.preventDefault();

      onDragStartRef.current();

      const pointer = toPhysicalScreenPosition(event.screenX, event.screenY);
      const scaleFactor = window.devicePixelRatio || 1;
      const physicalGrabOffset = {
        x: grabOffset.x * scaleFactor,
        y: grabOffset.y * scaleFactor,
      };
      dragOffsetRef.current = physicalGrabOffset;
      const anchor = {
        x: pointer.x + physicalGrabOffset.x,
        y: pointer.y + physicalGrabOffset.y,
      };
      void setAnchorPosition(anchor, "walls");

      isDraggingRef.current = true;
      activePointerIdRef.current = event.pointerId;
      pointerSamplesRef.current = [
        { x: pointer.x, y: pointer.y, time: event.timeStamp },
      ];

      setIsDragging(true);
      resetLeanState();
      onDragMoveRef.current?.(anchor);

      captureElementRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture(event.pointerId);

      clearResistTimeout();

      if (skipResistDelayRef.current) {
        onResistEndRef.current();
        return;
      }

      resistTimeoutRef.current = window.setTimeout(() => {
        onResistEndRef.current();
      }, RESIST_DURATION_MS);
    },
    [
      clearResistTimeout,
      grabOffset,
      isEnabled,
      resetLeanState,
      setAnchorPosition,
    ],
  );

  return {
    isDragging,
    grabbedLeanTier,
    onPointerDown,
  };
}
