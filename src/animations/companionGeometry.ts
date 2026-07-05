import type { AnimationDefinition } from "./types";

// default sprite geometry ratios for anchor math shared across all characters
export const SPRITE_WIDTH = 128;
export const SPRITE_HEIGHT = 128;
export const SPRITE_ANCHOR = { x: 64, y: 128 } as const;

// title bar sit: butt on the bar, legs/feet hang below
export const TITLE_BAR_SIT_ANCHOR = { x: 64, y: 112 } as const;
export const TITLE_BAR_SIT_Y_OFFSET = SPRITE_ANCHOR.y - TITLE_BAR_SIT_ANCHOR.y;

// window underside crawl
export const UNDERSIDE_GRAB_ANCHOR = { x: 64, y: 60 } as const;

// ~25ms per tick matches the shimeji engine cadence
export const TICK_INTERVAL_MS = 25;

export const LANDING_THRESHOLD = 4;

// fall physics from shimeji xml, bumped a bit for snappier drops
export const FALL_GRAVITY = 3;
export const FALL_AIR_RESISTANCE_X = 0.05;
export const FALL_AIR_RESISTANCE_Y = 0.05;

export function getFrameTickDuration(
  animation: AnimationDefinition,
  frameIndex: number,
): number {
  const perFrame = animation.frameTickDurations?.[frameIndex];
  return perFrame ?? animation.tickDuration;
}
