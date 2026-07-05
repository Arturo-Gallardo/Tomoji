import { SPRITE_ANCHOR } from "../animations/companionGeometry";
import type { DesktopBounds, MonitorWorkArea, ScreenPosition } from "../types/companion";

interface WallPadding {
  horizontal: number;
  vertical: number;
}

const DEFAULT_WALL_PADDING: WallPadding = {
  horizontal: SPRITE_ANCHOR.x,
  vertical: SPRITE_ANCHOR.y,
};

export function findMonitorAt(
  x: number,
  y: number,
  monitors: MonitorWorkArea[],
): MonitorWorkArea | null {
  for (const monitor of monitors) {
    const left = monitor.x;
    const right = monitor.x + monitor.width;
    const top = monitor.y;
    const bottom = monitor.y + monitor.height;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      return monitor;
    }
  }

  return null;
}

export function findMonitorByX(
  x: number,
  monitors: MonitorWorkArea[],
): MonitorWorkArea | null {
  if (monitors.length === 0) {
    return null;
  }

  for (const monitor of monitors) {
    const left = monitor.x;
    const right = monitor.x + monitor.width;

    if (x >= left && x <= right) {
      return monitor;
    }
  }

  let nearest = monitors[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const monitor of monitors) {
    const centerX = monitor.x + monitor.width / 2;
    const distance = Math.abs(x - centerX);

    if (distance < nearestDistance) {
      nearest = monitor;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getFloorYAt(
  x: number,
  y: number,
  monitors: MonitorWorkArea[],
): number {
  const monitor =
    findMonitorAt(x, y, monitors) ?? findMonitorByX(x, monitors) ?? monitors[0];

  if (!monitor) {
    return y;
  }

  return monitor.y + monitor.height;
}

export function clampToDesktopWalls(
  x: number,
  y: number,
  bounds: DesktopBounds,
  padding: WallPadding = DEFAULT_WALL_PADDING,
): ScreenPosition {
  const minX = bounds.virtualLeft + padding.horizontal;
  const maxX = bounds.virtualLeft + bounds.virtualWidth - padding.horizontal;
  const minY = bounds.virtualTop + padding.vertical;
  const maxY = bounds.virtualTop + bounds.virtualHeight;

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

export function getDesktopHorizontalRange(
  bounds: DesktopBounds,
  padding: WallPadding = DEFAULT_WALL_PADDING,
): { minX: number; maxX: number } {
  return {
    minX: bounds.virtualLeft + padding.horizontal,
    maxX: bounds.virtualLeft + bounds.virtualWidth - padding.horizontal,
  };
}

export function getRightmostMonitorFloorStart(
  bounds: DesktopBounds,
  padding: WallPadding = DEFAULT_WALL_PADDING,
): ScreenPosition {
  const rightmost = bounds.monitors.reduce<MonitorWorkArea | null>(
    (current, monitor) => {
      if (!current) {
        return monitor;
      }

      const currentRight = current.x + current.width;
      const monitorRight = monitor.x + monitor.width;

      return monitorRight > currentRight ? monitor : current;
    },
    null,
  );

  if (!rightmost) {
    return {
      x: bounds.virtualLeft + bounds.virtualWidth - padding.horizontal,
      y: bounds.virtualTop + bounds.virtualHeight,
    };
  }

  return {
    x: rightmost.x + rightmost.width - padding.horizontal,
    y: rightmost.y + rightmost.height,
  };
}
