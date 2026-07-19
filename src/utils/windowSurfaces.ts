import {
  SPRITE_ANCHOR,
  SPRITE_HEIGHT,
} from "../animations/companionGeometry";
import type {
  MonitorWorkArea,
  SurfaceLock,
  SurfaceLockKind,
  WindowBottomHit,
  WindowSurface,
  WindowWallHit,
  WindowWallSide,
} from "../types/companion";
import { getFloorYAt } from "./monitorBounds";
import { isScreenEdgeHwnd, SCREEN_EDGE_WALL_INSET } from "./screenEdgeWalls";

const HORIZONTAL_PADDING = SPRITE_ANCHOR.x;
const WALL_VERTICAL_PADDING = SPRITE_HEIGHT;
const UNDERSIDE_ANCHOR_Y_OFFSET = 5;

export const LOCKED_SURFACE_MOVE_THRESHOLD = 4;

export interface LockedSurfaceSnapshot {
  hwnd: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function isTitleBarLock(kind: SurfaceLockKind): boolean {
  return kind === "titleBar";
}

export function isWallLock(kind: SurfaceLockKind): boolean {
  return kind === "wallLeft" || kind === "wallRight";
}

export function isUndersideLock(kind: SurfaceLockKind): boolean {
  return kind === "underside";
}

export function surfaceLockFromTitleBar(hwnd: number): SurfaceLock {
  return { hwnd, kind: "titleBar" };
}

export function surfaceLockFromWall(wall: WindowWallHit): SurfaceLock {
  return {
    hwnd: wall.hwnd,
    kind: wall.side === "left" ? "wallLeft" : "wallRight",
  };
}

export function surfaceLockFromUnderside(hit: WindowBottomHit): SurfaceLock {
  return { hwnd: hit.hwnd, kind: "underside" };
}

export function windowSurfaceFromBottomHit(hit: WindowBottomHit): WindowSurface {
  return {
    hwnd: hit.hwnd,
    left: hit.left,
    right: hit.right,
    top: hit.top,
    bottom: hit.bottom,
    titleBarBottom: hit.top + 32,
  };
}

export function wallSideFromLock(kind: SurfaceLockKind): WindowWallSide | null {
  if (kind === "wallLeft") {
    return "left";
  }

  if (kind === "wallRight") {
    return "right";
  }

  return null;
}

export function windowSurfaceFromWallHit(wall: WindowWallHit): WindowSurface {
  return {
    hwnd: wall.hwnd,
    left: wall.left,
    right: wall.right,
    top: wall.top,
    bottom: wall.bottom,
    // wall hits don't need the title band — use a small fallback
    titleBarBottom: wall.top + 32,
  };
}

export function toLockedSurfaceSnapshot(
  surface: WindowSurface | WindowWallHit | WindowBottomHit,
): LockedSurfaceSnapshot {
  return {
    hwnd: surface.hwnd,
    left: surface.left,
    top: surface.top,
    right: surface.right,
    bottom: surface.bottom,
  };
}

export function hasLockedSurfaceMoved(
  previous: LockedSurfaceSnapshot,
  current: WindowSurface,
): boolean {
  if (previous.hwnd !== current.hwnd) {
    return true;
  }

  return (
    Math.abs(previous.top - current.top) > LOCKED_SURFACE_MOVE_THRESHOLD ||
    Math.abs(previous.left - current.left) > LOCKED_SURFACE_MOVE_THRESHOLD ||
    Math.abs(previous.right - current.right) > LOCKED_SURFACE_MOVE_THRESHOLD ||
    Math.abs(previous.bottom - current.bottom) > LOCKED_SURFACE_MOVE_THRESHOLD
  );
}

export function findSurfaceByHwnd(
  surfaces: WindowSurface[],
  hwnd: number | null,
): WindowSurface | null {
  if (hwnd === null) {
    return null;
  }

  return surfaces.find((surface) => surface.hwnd === hwnd) ?? null;
}

export function getSurfaceHorizontalRange(surface: WindowSurface): {
  minX: number;
  maxX: number;
} {
  return {
    minX: surface.left + HORIZONTAL_PADDING,
    maxX: surface.right - HORIZONTAL_PADDING,
  };
}

export function getWallVerticalRange(surface: WindowSurface): {
  minY: number;
  maxY: number;
} {
  return {
    minY: surface.top + WALL_VERTICAL_PADDING,
    maxY: surface.bottom,
  };
}

export function getWallAnchorX(
  surface: WindowSurface,
  kind: SurfaceLockKind,
): number {
  // desktop edges — partial inset so he hugs the bezel without half clipping off-screen
  if (isScreenEdgeHwnd(surface.hwnd)) {
    if (kind === "wallLeft") {
      return surface.left + SCREEN_EDGE_WALL_INSET;
    }

    return surface.right - SCREEN_EDGE_WALL_INSET;
  }

  if (kind === "wallLeft") {
    return surface.left;
  }

  return surface.right;
}

export function clampWallAnchorY(
  surface: WindowSurface,
  anchorY: number,
): number {
  const { minY, maxY } = getWallVerticalRange(surface);
  return Math.min(Math.max(anchorY, minY), maxY);
}

export function clampWallAnchorPosition(
  surface: WindowSurface,
  kind: SurfaceLockKind,
  anchorY: number,
): { x: number; y: number } {
  return {
    x: getWallAnchorX(surface, kind),
    y: clampWallAnchorY(surface, anchorY),
  };
}

export function getUndersideHorizontalRange(surface: WindowSurface): {
  minX: number;
  maxX: number;
} {
  return getSurfaceHorizontalRange(surface);
}

export function getUndersideAnchorY(surface: WindowSurface): number {
  return surface.bottom - UNDERSIDE_ANCHOR_Y_OFFSET;
}

export function clampUndersideAnchorX(
  surface: WindowSurface,
  anchorX: number,
): number {
  const { minX, maxX } = getUndersideHorizontalRange(surface);
  return clampXToRange(anchorX, minX, maxX);
}

export function clampUndersideAnchorPosition(
  surface: WindowSurface,
  anchorX: number,
): { x: number; y: number } {
  return {
    x: clampUndersideAnchorX(surface, anchorX),
    y: getUndersideAnchorY(surface),
  };
}

export function clampXToRange(x: number, minX: number, maxX: number): number {
  if (minX > maxX) {
    return (minX + maxX) / 2;
  }

  return Math.min(Math.max(x, minX), maxX);
}

export function resolveFloorYAt(
  x: number,
  y: number,
  monitors: MonitorWorkArea[],
  lockedSurface: WindowSurface | null,
  surfaceLock: SurfaceLock | null,
  titleBarSitYOffset = 0,
): number {
  if (lockedSurface && surfaceLock && isTitleBarLock(surfaceLock.kind)) {
    return lockedSurface.top + titleBarSitYOffset;
  }

  return getFloorYAt(x, y, monitors);
}
