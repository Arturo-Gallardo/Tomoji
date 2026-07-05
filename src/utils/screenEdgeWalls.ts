import { SPRITE_ANCHOR, SPRITE_HEIGHT } from "../animations/companionGeometry";
import type {
  DesktopBounds,
  MonitorWorkArea,
  WindowSurface,
  WindowWallHit,
  WindowWallSide,
} from "../types/companion";
import { findMonitorAt, findMonitorByX } from "./monitorBounds";

// matches window wall tolerances in rust, extended so floor-walk clamp positions still snap
const WALL_HIT_TOLERANCE_X = Math.max(36, SPRITE_ANCHOR.x + 8);
const WALL_HIT_TOLERANCE_Y = 32;
const MIN_WALL_CLIMB_HEIGHT = 160;

// hwnd 0 — screen edges aren't tied to a window
export const SCREEN_EDGE_HWND = 0;

// smaller than sprite half-width — hugs the bezel with a little overlap, not a full 64px gap
export const SCREEN_EDGE_WALL_INSET = 25;

export function isScreenEdgeHwnd(hwnd: number): boolean {
  return hwnd === SCREEN_EDGE_HWND;
}

function monitorForWallHit(
  x: number,
  y: number,
  monitors: MonitorWorkArea[],
): MonitorWorkArea | null {
  return findMonitorAt(x, y, monitors) ?? findMonitorByX(x, monitors);
}

function pointHitsVerticalEdge(
  monitor: MonitorWorkArea,
  side: WindowWallSide,
  x: number,
  y: number,
): boolean {
  if (monitor.height < MIN_WALL_CLIMB_HEIGHT) {
    return false;
  }

  const left = monitor.x;
  const right = monitor.x + monitor.width;
  const top = monitor.y;
  const bottom = monitor.y + monitor.height;
  const xRounded = Math.round(x);
  const yRounded = Math.round(y);

  const onX =
    side === "left"
      ? xRounded >= left - WALL_HIT_TOLERANCE_X &&
        xRounded <= left + WALL_HIT_TOLERANCE_X
      : xRounded >= right - WALL_HIT_TOLERANCE_X &&
        xRounded <= right + WALL_HIT_TOLERANCE_X;

  const onY =
    yRounded >= top + SPRITE_HEIGHT - WALL_HIT_TOLERANCE_Y &&
    yRounded <= bottom + WALL_HIT_TOLERANCE_Y;

  return onX && onY;
}

function wallHitFromMonitor(
  monitor: MonitorWorkArea,
  side: WindowWallSide,
): WindowWallHit {
  return {
    hwnd: SCREEN_EDGE_HWND,
    left: monitor.x,
    right: monitor.x + monitor.width,
    top: monitor.y,
    bottom: monitor.y + monitor.height,
    side,
  };
}

export function hitScreenEdgeWallAt(
  x: number,
  y: number,
  bounds: DesktopBounds,
): WindowWallHit | null {
  const monitor = monitorForWallHit(x, y, bounds.monitors);
  if (!monitor) {
    return null;
  }

  const hitsLeft = pointHitsVerticalEdge(monitor, "left", x, y);
  const hitsRight = pointHitsVerticalEdge(monitor, "right", x, y);

  if (hitsLeft && hitsRight) {
    const distLeft = Math.abs(Math.round(x) - monitor.x);
    const distRight = Math.abs(Math.round(x) - (monitor.x + monitor.width));
    return wallHitFromMonitor(
      monitor,
      distLeft <= distRight ? "left" : "right",
    );
  }

  if (hitsLeft) {
    return wallHitFromMonitor(monitor, "left");
  }

  if (hitsRight) {
    return wallHitFromMonitor(monitor, "right");
  }

  return null;
}

export function screenEdgeSurfaceFromMonitor(
  monitor: MonitorWorkArea,
): WindowSurface {
  return {
    hwnd: SCREEN_EDGE_HWND,
    left: monitor.x,
    right: monitor.x + monitor.width,
    top: monitor.y,
    bottom: monitor.y + monitor.height,
    titleBarBottom: monitor.y + 32,
  };
}

export function screenEdgeSurfaceFromWallHit(
  wall: WindowWallHit,
): WindowSurface {
  return {
    hwnd: SCREEN_EDGE_HWND,
    left: wall.left,
    right: wall.right,
    top: wall.top,
    bottom: wall.bottom,
    titleBarBottom: wall.top + 32,
  };
}
