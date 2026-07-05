import { useEffect, useRef } from "react";
import {
  FALL_AIR_RESISTANCE_X,
  FALL_AIR_RESISTANCE_Y,
  FALL_GRAVITY,
  LANDING_THRESHOLD,
  TICK_INTERVAL_MS,
} from "../animations/companionGeometry";
import type { FallVelocity, ScreenPosition } from "../types/companion";

interface UseCompanionFallOptions {
  isActive: boolean;
  initialVelocity: FallVelocity;
  getFloorYAt: (x: number, y: number) => number;
  clampToWalls: (x: number, y: number) => ScreenPosition;
  getAnchorPosition: () => ScreenPosition;
  onPositionChange: (position: ScreenPosition) => void;
  onLand: () => void;
}

export function useCompanionFall({
  isActive,
  initialVelocity,
  getFloorYAt,
  clampToWalls,
  getAnchorPosition,
  onPositionChange,
  onLand,
}: UseCompanionFallOptions): void {
  const velocityRef = useRef<FallVelocity>({ x: 0, y: 0 });
  const onLandRef = useRef(onLand);
  const onPositionChangeRef = useRef(onPositionChange);
  const getAnchorPositionRef = useRef(getAnchorPosition);
  const getFloorYAtRef = useRef(getFloorYAt);
  const clampToWallsRef = useRef(clampToWalls);

  useEffect(() => {
    onLandRef.current = onLand;
    onPositionChangeRef.current = onPositionChange;
    getAnchorPositionRef.current = getAnchorPosition;
    getFloorYAtRef.current = getFloorYAt;
    clampToWallsRef.current = clampToWalls;
  }, [clampToWalls, getAnchorPosition, getFloorYAt, onLand, onPositionChange]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    velocityRef.current = { ...initialVelocity };

    const intervalId = window.setInterval(() => {
      const velocity = velocityRef.current;
      const anchor = getAnchorPositionRef.current();

      velocity.x *= 1 - FALL_AIR_RESISTANCE_X;
      velocity.y = velocity.y * (1 - FALL_AIR_RESISTANCE_Y) + FALL_GRAVITY;

      const rawNextX = anchor.x + velocity.x;
      const rawNextY = anchor.y + velocity.y;
      const walled = clampToWallsRef.current(rawNextX, rawNextY);
      const floorY = getFloorYAtRef.current(walled.x, walled.y);

      if (walled.x !== rawNextX) {
        velocity.x = 0;
      }

      if (walled.y !== rawNextY && rawNextY < anchor.y) {
        velocity.y = 0;
      }

      if (walled.y >= floorY - LANDING_THRESHOLD) {
        onPositionChangeRef.current({
          x: walled.x,
          y: floorY,
        });
        onLandRef.current();
        return;
      }

      onPositionChangeRef.current(walled);
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialVelocity, isActive]);
}
