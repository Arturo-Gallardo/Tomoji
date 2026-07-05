import type { ScreenPosition } from "../types/companion";

export function toPhysicalScreenPosition(
  screenX: number,
  screenY: number,
): ScreenPosition {
  const scaleFactor = window.devicePixelRatio || 1;

  return {
    x: screenX * scaleFactor,
    y: screenY * scaleFactor,
  };
}
