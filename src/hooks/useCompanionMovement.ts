import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { AnimationRegistry } from "../services/animationRegistry";
import {
  getDesktopBounds,
  hitWindowSurfaceAt,
  setCompanionPosition,
} from "../services/companionApi";
import type {
  AnchorClampMode,
  DesktopBounds,
  ScreenPosition,
  SurfaceLock,
  WindowSurface,
} from "../types/companion";
import {
  clampToDesktopWalls,
  getDesktopHorizontalRange,
  getRightmostMonitorFloorStart,
} from "../utils/monitorBounds";
import {
  hitScreenEdgeCeilingAt,
  hitScreenEdgeWallAt,
  isScreenEdgeHwnd,
  screenEdgeSurfaceFromCeilingHit,
  screenEdgeSurfaceFromWallHit,
} from "../utils/screenEdgeWalls";
import {
  clampUndersideAnchorPosition,
  clampWallAnchorPosition,
  clampWallAnchorY,
  clampXToRange,
  findSurfaceByHwnd,
  getSurfaceHorizontalRange,
  getWallVerticalRange,
  hasLockedSurfaceMoved,
  isTitleBarLock,
  isUndersideLock,
  isWallLock,
  resolveFloorYAt,
  surfaceLockFromWall,
  toLockedSurfaceSnapshot,
  type LockedSurfaceSnapshot,
} from "../utils/windowSurfaces";
import { useCompanionWindowSurfaces } from "./useCompanionWindowSurfaces";

const WALL_SPRITE_SURFACE_NUDGE = -5;

interface UseCompanionMovementOptions {
  registry: AnimationRegistry;
  scale: number;
  initialAnchor?: ScreenPosition;
  positionMode?: "window" | "overlay";
  sharedSurfaces?: WindowSurface[];
  sharedSurfacesRef?: RefObject<WindowSurface[]>;
  onSurfaceLockLost?: () => void;
  usesTitleBarSitAnchorRef?: RefObject<boolean>;
}

interface UseCompanionMovementResult {
  desktopBounds: DesktopBounds | null;
  anchorX: number;
  anchorY: number;
  anchorXOffset: number;
  anchorYOffset: number;
  isReady: boolean;
  surfaceLock: SurfaceLock | null;
  isSurfaceLocked: boolean;
  isWallLocked: boolean;
  isUndersideLocked: boolean;
  moveBy: (deltaX: number) => boolean;
  moveByY: (deltaY: number) => boolean;
  setAnchorX: (nextX: number) => Promise<void>;
  setAnchorPosition: (
    position: ScreenPosition,
    mode?: AnchorClampMode,
  ) => Promise<void>;
  clampAnchorX: (x: number) => number;
  clampToWalls: (x: number, y: number) => ScreenPosition;
  clampAnchorPosition: (x: number, y: number) => ScreenPosition;
  getFloorYAt: (x: number, y: number) => number;
  getAnchorPosition: () => ScreenPosition;
  getHorizontalWalkRange: () => { minX: number; maxX: number } | null;
  getVerticalClimbRange: () => { minY: number; maxY: number } | null;
  releaseSurfaceLockForDrag: () => void;
  getSurfaceLockAt: (x: number, y: number) => Promise<SurfaceLock | null>;
  tryLockSurfaceAt: (
    x: number,
    y: number,
    expectedLock?: SurfaceLock,
  ) => Promise<SurfaceLock | null>;
}

interface SurfaceLockCandidate {
  lock: SurfaceLock;
  surface: WindowSurface;
}

function isInsideDesktopBounds(
  position: ScreenPosition,
  bounds: DesktopBounds,
): boolean {
  return (
    position.x >= bounds.virtualLeft &&
    position.x <= bounds.virtualLeft + bounds.virtualWidth &&
    position.y >= bounds.virtualTop &&
    position.y <= bounds.virtualTop + bounds.virtualHeight
  );
}

export function useCompanionMovement(
  options: UseCompanionMovementOptions,
): UseCompanionMovementResult {
  const {
    registry,
    scale,
    initialAnchor,
    positionMode = "window",
    sharedSurfaces,
    sharedSurfacesRef,
    onSurfaceLockLost,
    usesTitleBarSitAnchorRef,
  } = options;
  const onSurfaceLockLostRef = useRef(onSurfaceLockLost);

  useEffect(() => {
    onSurfaceLockLostRef.current = onSurfaceLockLost;
  }, [onSurfaceLockLost]);

  const [desktopBounds, setDesktopBounds] = useState<DesktopBounds | null>(
    null,
  );
  const [anchorX, setAnchorXState] = useState(0);
  const [anchorY, setAnchorYState] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [surfaceLock, setSurfaceLock] = useState<SurfaceLock | null>(null);

  const anchorRef = useRef<ScreenPosition>({ x: 0, y: 0 });
  const desktopBoundsRef = useRef<DesktopBounds | null>(null);
  const surfaceLockRef = useRef<SurfaceLock | null>(null);
  const lockedSurfaceSnapshotRef = useRef<LockedSurfaceSnapshot | null>(null);
  const lockedSurfaceCacheRef = useRef<WindowSurface | null>(null);
  const initialAnchorRef = useRef(initialAnchor);

  const polledWindowSurfaces = useCompanionWindowSurfaces(
    isReady && surfaceLock !== null && sharedSurfaces === undefined,
  );
  const surfaces = sharedSurfaces ?? polledWindowSurfaces.surfaces;
  const surfacesRef = sharedSurfacesRef ?? polledWindowSurfaces.surfacesRef;

  const getAnchorYOffset = useCallback((): number => {
    const lock = surfaceLockRef.current;
    if (lock && isUndersideLock(lock.kind)) {
      return registry.getUndersideAnchorYOffset() * scale;
    }

    return registry.getSpriteAnchor("idle").y * scale;
  }, [registry, scale]);

  const getAnchorXOffset = useCallback((): number => {
    const lock = surfaceLockRef.current;

    if (!lock || !isWallLock(lock.kind)) {
      return (registry.spriteWidth / 2) * scale;
    }

    const physicalWallKind = lock.kind === "wallLeft" ? "wallLeft" : "wallRight";
    const offsetWallKind = isScreenEdgeHwnd(lock.hwnd)
      ? physicalWallKind === "wallLeft"
        ? "wallRight"
        : "wallLeft"
      : physicalWallKind;
    const baseOffset = registry.getWallAnchorXOffset(offsetWallKind) * scale;
    const nudge = WALL_SPRITE_SURFACE_NUDGE * scale;
    return physicalWallKind === "wallLeft" ? baseOffset - nudge : baseOffset + nudge;
  }, [registry, scale]);
  const undersideProbeYOffset =
    (registry.getSpriteAnchor("idle").y - registry.spriteHeight / 2) * scale;

  useEffect(() => {
    desktopBoundsRef.current = desktopBounds;
  }, [desktopBounds]);

  useEffect(() => {
    surfaceLockRef.current = surfaceLock;
  }, [surfaceLock]);

  const getLockedSurface = useCallback((): WindowSurface | null => {
    const lock = surfaceLockRef.current;
    if (!lock) {
      return null;
    }

    if (isScreenEdgeHwnd(lock.hwnd)) {
      return lockedSurfaceCacheRef.current;
    }

    const hwnd = lock.hwnd;
    const fromPoll = findSurfaceByHwnd(surfacesRef.current, hwnd);

    if (fromPoll) {
      lockedSurfaceCacheRef.current = fromPoll;
      return fromPoll;
    }

    return lockedSurfaceCacheRef.current;
  }, [surfacesRef]);

  const getHorizontalBounds = useCallback((): {
    minX: number;
    maxX: number;
  } | null => {
    const lock = surfaceLockRef.current;
    const lockedSurface = getLockedSurface();

    if (lockedSurface && lock && isTitleBarLock(lock.kind)) {
      return getSurfaceHorizontalRange(lockedSurface);
    }

    if (lockedSurface && lock && isUndersideLock(lock.kind)) {
      return getSurfaceHorizontalRange(lockedSurface);
    }

    const bounds = desktopBoundsRef.current;
    if (!bounds) {
      return null;
    }

    return getDesktopHorizontalRange(bounds);
  }, [getLockedSurface]);

  const resolveFloorYAtPosition = useCallback(
    (x: number, y: number): number => {
      const bounds = desktopBoundsRef.current;
      if (!bounds) {
        return y;
      }

      return resolveFloorYAt(
        x,
        y,
        bounds.monitors,
        getLockedSurface(),
        surfaceLockRef.current,
        usesTitleBarSitAnchorRef?.current
          ? registry.getTitleBarSitYOffset() * scale
          : 0,
      );
    },
    [getLockedSurface, registry, scale, usesTitleBarSitAnchorRef],
  );

  const clampHorizontalX = useCallback(
    (x: number): number => {
      const range = getHorizontalBounds();
      if (!range) {
        return x;
      }

      return clampXToRange(x, range.minX, range.maxX);
    },
    [getHorizontalBounds],
  );

  const clampToWallsPosition = useCallback(
    (x: number, y: number): ScreenPosition => {
      const bounds = desktopBoundsRef.current;
      const horizontalX = clampHorizontalX(x);

      if (!bounds) {
        return { x: horizontalX, y };
      }

      const walled = clampToDesktopWalls(horizontalX, y, bounds);

      return {
        x: clampHorizontalX(walled.x),
        y: walled.y,
      };
    },
    [clampHorizontalX],
  );

  const clampLockedPosition = useCallback(
    (x: number, y: number): ScreenPosition => {
      const lock = surfaceLockRef.current;
      const lockedSurface = getLockedSurface();

      if (lockedSurface && lock && isWallLock(lock.kind)) {
        return clampWallAnchorPosition(lockedSurface, lock.kind, y);
      }

      if (lockedSurface && lock && isUndersideLock(lock.kind)) {
        return clampUndersideAnchorPosition(lockedSurface, x);
      }

      const walled = clampToWallsPosition(x, y);

      return {
        x: walled.x,
        y: resolveFloorYAtPosition(walled.x, walled.y),
      };
    },
    [clampToWallsPosition, getLockedSurface, resolveFloorYAtPosition],
  );

  const clampGroundedPosition = useCallback(
    (x: number, y: number): ScreenPosition => {
      const lock = surfaceLockRef.current;

      if (lock && (isWallLock(lock.kind) || isUndersideLock(lock.kind))) {
        return clampLockedPosition(x, y);
      }

      const walled = clampToWallsPosition(x, y);

      return {
        x: walled.x,
        y: resolveFloorYAtPosition(walled.x, walled.y),
      };
    },
    [clampLockedPosition, clampToWallsPosition, resolveFloorYAtPosition],
  );

  const clampAnchorX = useCallback(
    (x: number): number => {
      return clampHorizontalX(x);
    },
    [clampHorizontalX],
  );

  const refreshDesktopBoundsIfNeeded = useCallback(
    async (position: ScreenPosition) => {
      const bounds = desktopBoundsRef.current;
      if (bounds && isInsideDesktopBounds(position, bounds)) {
        return;
      }

      try {
        const nextBounds = await getDesktopBounds();
        desktopBoundsRef.current = nextBounds;
        setDesktopBounds(nextBounds);
      } catch {
        // keep the previous bounds; movement will clamp safely
      }
    },
    [],
  );

  const applyAnchorPosition = useCallback(
    async (position: ScreenPosition, mode: AnchorClampMode = "grounded") => {
      await refreshDesktopBoundsIfNeeded(position);

      const nextPosition =
        mode === "walls"
          ? clampToWallsPosition(position.x, position.y)
          : mode === "locked"
            ? clampLockedPosition(position.x, position.y)
            : clampGroundedPosition(position.x, position.y);

      anchorRef.current = nextPosition;
      setAnchorXState(nextPosition.x);
      setAnchorYState(nextPosition.y);

      if (positionMode === "window") {
        await setCompanionPosition(
          nextPosition,
          getAnchorYOffset(),
          getAnchorXOffset(),
        );
      }
    },
    [
      clampGroundedPosition,
      clampLockedPosition,
      clampToWallsPosition,
      getAnchorXOffset,
      getAnchorYOffset,
      positionMode,
      refreshDesktopBoundsIfNeeded,
    ],
  );
  const applyAnchorPositionRef = useRef(applyAnchorPosition);
  applyAnchorPositionRef.current = applyAnchorPosition;

  const clearSurfaceLock = useCallback(() => {
    surfaceLockRef.current = null;
    lockedSurfaceSnapshotRef.current = null;
    lockedSurfaceCacheRef.current = null;
    setSurfaceLock(null);
  }, []);

  const releaseSurfaceLockForDrag = useCallback(() => {
    const lock = surfaceLockRef.current;
    const current = anchorRef.current;

    clearSurfaceLock();

    if (!lock || !isUndersideLock(lock.kind)) {
      return;
    }

    const nextPosition = {
      x: current.x,
      y:
        current.y +
        (registry.getSpriteAnchor("idle").y -
          registry.getSpriteAnchor("grabCeiling").y) *
          scale,
    };

    anchorRef.current = nextPosition;
    setAnchorYState(nextPosition.y);
    if (positionMode === "window") {
      void setCompanionPosition(
        nextPosition,
        registry.getSpriteAnchor("idle").y * scale,
        getAnchorXOffset(),
      );
    }
  }, [clearSurfaceLock, getAnchorXOffset, positionMode, registry, scale]);

  const findSurfaceLockAt = useCallback(
    async (x: number, y: number): Promise<SurfaceLockCandidate | null> => {
      try {
        const hit = await hitWindowSurfaceAt(x, y, y - undersideProbeYOffset);

        if (hit) {
          return {
            lock: { hwnd: hit.surface.hwnd, kind: hit.kind },
            surface: hit.surface,
          };
        }

        const bounds = desktopBoundsRef.current;
        if (bounds) {
          const screenCeiling = hitScreenEdgeCeilingAt(x, y, bounds);
          if (screenCeiling) {
            return {
              lock: { hwnd: screenCeiling.hwnd, kind: "underside" },
              surface: screenEdgeSurfaceFromCeilingHit(screenCeiling),
            };
          }

          const screenEdge = hitScreenEdgeWallAt(x, y, bounds);
          if (screenEdge) {
            return {
              lock: surfaceLockFromWall(screenEdge),
              surface: screenEdgeSurfaceFromWallHit(screenEdge),
            };
          }
        }

        return null;
      } catch {
        return null;
      }
    },
    [undersideProbeYOffset],
  );

  const getSurfaceLockAt = useCallback(
    async (x: number, y: number): Promise<SurfaceLock | null> => {
      return (await findSurfaceLockAt(x, y))?.lock ?? null;
    },
    [findSurfaceLockAt],
  );

  const tryLockSurfaceAt = useCallback(
    async (
      x: number,
      y: number,
      expectedLock?: SurfaceLock,
    ): Promise<SurfaceLock | null> => {
      const candidate = await findSurfaceLockAt(x, y);
      if (
        !candidate ||
        (expectedLock &&
          (candidate.lock.hwnd !== expectedLock.hwnd ||
            candidate.lock.kind !== expectedLock.kind))
      ) {
        return null;
      }

      lockedSurfaceCacheRef.current = candidate.surface;
      surfaceLockRef.current = candidate.lock;
      lockedSurfaceSnapshotRef.current = toLockedSurfaceSnapshot(
        candidate.surface,
      );
      setSurfaceLock(candidate.lock);
      return candidate.lock;
    },
    [findSurfaceLockAt],
  );

  useEffect(() => {
    if (surfaceLock === null) {
      lockedSurfaceSnapshotRef.current = null;
      return;
    }

    // monitor edges don't move — lock stays until drag clears it
    if (isScreenEdgeHwnd(surfaceLock.hwnd)) {
      return;
    }

    const lockedSurface = findSurfaceByHwnd(surfaces, surfaceLock.hwnd);

    // wait for the first surface poll before deciding the host window is gone
    if (!lockedSurface) {
      if (surfaces.length === 0) {
        return;
      }

      clearSurfaceLock();
      onSurfaceLockLostRef.current?.();
      return;
    }

    const previousSnapshot = lockedSurfaceSnapshotRef.current;
    if (!previousSnapshot) {
      lockedSurfaceSnapshotRef.current = toLockedSurfaceSnapshot(lockedSurface);
      return;
    }

    if (hasLockedSurfaceMoved(previousSnapshot, lockedSurface)) {
      lockedSurfaceCacheRef.current = lockedSurface;
      lockedSurfaceSnapshotRef.current = toLockedSurfaceSnapshot(lockedSurface);
      void applyAnchorPositionRef.current(anchorRef.current, "locked");
      return;
    }

    lockedSurfaceSnapshotRef.current = toLockedSurfaceSnapshot(lockedSurface);
  }, [clearSurfaceLock, surfaceLock, surfaces]);

  useEffect(() => {
    let cancelled = false;

    async function initPosition() {
      const bounds = await getDesktopBounds();
      if (cancelled) {
        return;
      }

      setDesktopBounds(bounds);
      desktopBoundsRef.current = bounds;

      // prefer the instance's saved anchor; fall back to the default corner
      const startPosition =
        initialAnchorRef.current ?? getRightmostMonitorFloorStart(bounds);

      await applyAnchorPositionRef.current(startPosition, "grounded");
      if (!cancelled) {
        setIsReady(true);
      }
    }

    void initPosition();

    return () => {
      cancelled = true;
    };
  }, []);

  const getAnchorPosition = useCallback((): ScreenPosition => {
    return anchorRef.current;
  }, []);

  const moveBy = useCallback(
    (deltaX: number): boolean => {
      const lock = surfaceLockRef.current;
      if (lock && isWallLock(lock.kind)) {
        return false;
      }

      const current = anchorRef.current;
      const nextX = clampAnchorX(current.x + deltaX);

      if (nextX === current.x && Math.abs(deltaX) > 0) {
        return false;
      }

      const mode = lock && isUndersideLock(lock.kind) ? "locked" : "grounded";

      void applyAnchorPosition(
        {
          x: nextX,
          y: current.y,
        },
        mode,
      );

      return true;
    },
    [applyAnchorPosition, clampAnchorX],
  );

  const moveByY = useCallback(
    (deltaY: number): boolean => {
      const lock = surfaceLockRef.current;
      const lockedSurface = getLockedSurface();

      if (!lock || !lockedSurface || !isWallLock(lock.kind)) {
        return false;
      }

      const current = anchorRef.current;
      const nextY = clampWallAnchorY(lockedSurface, current.y + deltaY);

      if (nextY === current.y && Math.abs(deltaY) > 0) {
        return false;
      }

      void applyAnchorPosition(
        clampWallAnchorPosition(lockedSurface, lock.kind, nextY),
        "locked",
      );

      return true;
    },
    [applyAnchorPosition, getLockedSurface],
  );

  const setAnchorX = useCallback(
    async (nextX: number) => {
      const current = anchorRef.current;
      const lock = surfaceLockRef.current;
      const mode = lock && isUndersideLock(lock.kind) ? "locked" : "grounded";

      await applyAnchorPosition({ x: clampAnchorX(nextX), y: current.y }, mode);
    },
    [applyAnchorPosition, clampAnchorX],
  );

  const setAnchorPosition = useCallback(
    async (position: ScreenPosition, mode: AnchorClampMode = "grounded") => {
      await applyAnchorPosition(position, mode);
    },
    [applyAnchorPosition],
  );

  const getHorizontalWalkRange = useCallback((): {
    minX: number;
    maxX: number;
  } | null => {
    return getHorizontalBounds();
  }, [getHorizontalBounds]);

  const getVerticalClimbRange = useCallback((): {
    minY: number;
    maxY: number;
  } | null => {
    const lock = surfaceLockRef.current;
    const lockedSurface = getLockedSurface();

    if (!lock || !lockedSurface || !isWallLock(lock.kind)) {
      return null;
    }

    return getWallVerticalRange(lockedSurface);
  }, [getLockedSurface]);

  return {
    desktopBounds,
    anchorX,
    anchorY,
    anchorXOffset: getAnchorXOffset(),
    anchorYOffset: getAnchorYOffset(),
    isReady,
    surfaceLock,
    isSurfaceLocked: surfaceLock !== null,
    isWallLocked:
      surfaceLock !== null &&
      (surfaceLock.kind === "wallLeft" || surfaceLock.kind === "wallRight"),
    isUndersideLocked: surfaceLock !== null && surfaceLock.kind === "underside",
    moveBy,
    moveByY,
    setAnchorX,
    setAnchorPosition,
    clampAnchorX,
    clampToWalls: clampToWallsPosition,
    clampAnchorPosition: clampGroundedPosition,
    getFloorYAt: resolveFloorYAtPosition,
    getAnchorPosition,
    getHorizontalWalkRange,
    getVerticalClimbRange,
    releaseSurfaceLockForDrag,
    getSurfaceLockAt,
    tryLockSurfaceAt,
  };
}
