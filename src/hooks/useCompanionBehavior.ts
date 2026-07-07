import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showCompanionMenu } from "../services/companionMenuApi";
import type { AnimationRegistry } from "../services/animationRegistry";
import type { DialogueSettings, BehaviorSettings } from "../types/character";
import { normalizeBehaviorSettings } from "../services/behaviorSettings";
import type {
  CompanionAction,
  FacingDirection,
  GrabbedLeanTier,
} from "../animations/types";
import type { CompanionMenuAnimationAction } from "../types/companionMenu";
import { LANDING_THRESHOLD } from "../animations/companionGeometry";
import { usesTitleBarSitAnchor } from "../animations/beyondBirthday";
import {
  type AnchorClampMode,
  type CompanionBehaviorState,
  type FallVelocity,
  type ScreenPosition,
  type SurfaceLock,
} from "../types/companion";
import { toPhysicalScreenPosition } from "../utils/screenCoordinates";
import { DIALOGUE_DISPLAY_MS } from "../utils/dialogueDuration";
import { isScreenEdgeHwnd } from "../utils/screenEdgeWalls";
import { useCompanionDrag } from "./useCompanionDrag";
import { useAutonomousDialogue } from "./useAutonomousDialogue";
import { useCompanionFall } from "./useCompanionFall";
import type { WindowWallSide } from "../types/companion";
import { isTitleBarLock, isWallLock, wallSideFromLock } from "../utils/windowSurfaces";
import { useCompanionMovement } from "./useCompanionMovement";

const MIN_IDLE_MS = 3000;
const MAX_IDLE_MS = 8000;
const MIN_WALK_DISTANCE = 80;
const SNAP_HOVER_DURATION_MS = 500;
const MOVEMENT_SPEED_SCALE = 2;

const MIN_AUTONOMOUS_SIT_MS = 20000;
const MAX_AUTONOMOUS_SIT_MS = 55000;
type SittingMode = "manual" | "auto" | null;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomIdleDelay(actionFrequency: number): number {
  const urgency = Math.max(actionFrequency, 0.05);
  const scale = 1 / urgency;
  return randomBetween(MIN_IDLE_MS * scale, MAX_IDLE_MS * scale);
}

function pickWeightedAction<T>(
  options: readonly { value: T; weight: number }[],
): T | null {
  const total = options.reduce(
    (sum, option) => sum + Math.max(0, option.weight),
    0,
  );
  if (total <= 0) {
    return null;
  }

  let cursor = Math.random() * total;
  for (const option of options) {
    cursor -= Math.max(0, option.weight);
    if (cursor <= 0) {
      return option.value;
    }
  }

  return options[options.length - 1]?.value ?? null;
}

function isSameSurfaceLock(
  first: SurfaceLock | null,
  second: SurfaceLock | null,
): boolean {
  return first?.hwnd === second?.hwnd && first?.kind === second?.kind;
}

interface UseCompanionBehaviorResult {
  action: CompanionAction;
  displayAction: CompanionAction;
  facing: FacingDirection;
  behaviorState: CompanionBehaviorState;
  dialogueText: string | null;
  isReady: boolean;
  showTitleBarLockHint: boolean;
  wallSide: WindowWallSide | null;
  grabbedLeanTier: GrabbedLeanTier;
  getAnchorPosition: () => ScreenPosition;
  setAnchorPosition: (
    position: ScreenPosition,
    mode?: AnchorClampMode,
  ) => Promise<void>;
  onWalkTick: (deltaX: number) => void;
  onClimbTick: (deltaY: number) => void;
  onAnimationCycleComplete: (action: CompanionAction) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  startDialogue: (text: string) => void;
  dismissDialogue: () => void;
  toggleSit: () => void;
  playMenuAnimation: (action: CompanionMenuAnimationAction) => void;
  turnAround: () => void;
  walkToAnchorX: (screenX: number) => void;
  floorCrawlToAnchorX: (screenX: number) => void;
  crawlToAnchorX: (screenX: number) => void;
  climbToAnchorY: (screenY: number) => void;
  isFrozen: boolean;
  toggleFreeze: () => void;
  unfreeze: () => void;
  canOpenContextMenu: boolean;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
}

interface UseCompanionBehaviorOptions {
  registry: AnimationRegistry;
  characterId: string;
  scale: number;
  initialAnchor?: ScreenPosition;
  dialogueSettings?: DialogueSettings;
  behaviorSettings?: BehaviorSettings;
  isMuted?: boolean;
}

export function useCompanionBehavior({
  registry,
  characterId,
  scale,
  initialAnchor,
  dialogueSettings,
  behaviorSettings,
  isMuted = false,
}: UseCompanionBehaviorOptions): UseCompanionBehaviorResult {
  const normalizedBehaviorSettings = useMemo(
    () => normalizeBehaviorSettings(behaviorSettings),
    [behaviorSettings],
  );
  const behaviorSettingsRef = useRef(normalizedBehaviorSettings);

  useEffect(() => {
    behaviorSettingsRef.current = normalizedBehaviorSettings;
  }, [normalizedBehaviorSettings]);
  const handleSurfaceLockLostRef = useRef<() => void>(() => {});
  const usesTitleBarSitAnchorRef = useRef(false);

  const {
    anchorX,
    anchorY,
    isReady,
    surfaceLock,
    isWallLocked,
    isUndersideLocked,
    moveBy,
    moveByY,
    setAnchorX,
    setAnchorPosition,
    clampAnchorX,
    clampToWalls,
    getFloorYAt,
    getAnchorPosition,
    getHorizontalWalkRange,
    getVerticalClimbRange,
    releaseSurfaceLockForDrag,
    getSurfaceLockAt,
    tryLockSurfaceAt,
  } = useCompanionMovement({
    registry,
    scale,
    initialAnchor,
    onSurfaceLockLost: () => {
      handleSurfaceLockLostRef.current();
    },
    usesTitleBarSitAnchorRef,
  });

  const [behaviorState, setBehaviorState] =
    useState<CompanionBehaviorState>("idle");
  const [action, setAction] = useState<CompanionAction>("idle");
  const [facing, setFacing] = useState<FacingDirection>("left");
  const [fallVelocity, setFallVelocity] = useState<FallVelocity>({
    x: 0,
    y: 0,
  });
  const [skipResistOnGrab, setSkipResistOnGrab] = useState(false);
  const [dialogueText, setDialogueText] = useState<string | null>(null);
  const [showTitleBarLockHint, setShowTitleBarLockHint] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  const targetXRef = useRef<number | null>(null);
  const targetYRef = useRef<number | null>(null);
  const walkingCanAttachRef = useRef(false);
  const snapHintProbeRef = useRef(0);
  const snapHintProbeInFlightRef = useRef(false);
  const pendingSnapHintAnchorRef = useRef<ScreenPosition | null>(null);
  const snapHoverTimeoutRef = useRef<number | null>(null);
  const snapHoverTargetRef = useRef<SurfaceLock | null>(null);
  const qualifiedSnapTargetRef = useRef<SurfaceLock | null>(null);
  const runSnapHintProbeRef = useRef<() => void>(() => {});
  const anchorXRef = useRef(anchorX);
  const anchorYRef = useRef(anchorY);
  const isDraggingRef = useRef(false);
  const behaviorStateRef = useRef(behaviorState);
  const dialogueReturnStateRef = useRef<"idle" | "sitting">("idle");
  const sittingModeRef = useRef<SittingMode>(null);
  const sittingActionRef = useRef<CompanionAction>("sit");
  const isMutedRef = useRef(isMuted);

  const isWallLockedRef = useRef(isWallLocked);
  const isUndersideLockedRef = useRef(isUndersideLocked);
  const isFrozenRef = useRef(isFrozen);

  useEffect(() => {
    isWallLockedRef.current = isWallLocked;
  }, [isWallLocked]);

  useEffect(() => {
    isUndersideLockedRef.current = isUndersideLocked;
  }, [isUndersideLocked]);

  useEffect(() => {
    isFrozenRef.current = isFrozen;
  }, [isFrozen]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const unfreeze = useCallback(() => {
    isFrozenRef.current = false;
    setIsFrozen(false);
  }, []);

  useEffect(() => {
    anchorXRef.current = anchorX;
  }, [anchorX]);

  useEffect(() => {
    anchorYRef.current = anchorY;
  }, [anchorY]);

  useEffect(() => {
    behaviorStateRef.current = behaviorState;
  }, [behaviorState]);

  const displayAction = useMemo(
    () => registry.resolveDisplayAction(action, surfaceLock),
    [action, registry, surfaceLock],
  );

  const wallSide = useMemo((): WindowWallSide | null => {
    if (!surfaceLock) {
      return null;
    }

    const side = wallSideFromLock(surfaceLock.kind);
    if (!side) {
      return null;
    }

    // inset desktop anchors flip the cling pose vs window walls
    if (isScreenEdgeHwnd(surfaceLock.hwnd)) {
      return side === "left" ? "right" : "left";
    }

    return side;
  }, [surfaceLock]);

  usesTitleBarSitAnchorRef.current =
    surfaceLock !== null &&
    isTitleBarLock(surfaceLock.kind) &&
    usesTitleBarSitAnchor(displayAction);

  // reclamp Y when switching between standing on the bar vs dangling sit pose
  useEffect(() => {
    if (!isReady || !surfaceLock || !isTitleBarLock(surfaceLock.kind)) {
      return;
    }

    const anchor = getAnchorPosition();
    void setAnchorPosition(anchor, "grounded");
  }, [displayAction, getAnchorPosition, isReady, setAnchorPosition, surfaceLock]);

  const startBounce = useCallback(() => {
    setBehaviorState("bouncing");
    setAction("bounce");
  }, []);

  const returnToIdle = useCallback(() => {
    targetXRef.current = null;
    targetYRef.current = null;
    isDraggingRef.current = false;
    sittingModeRef.current = null;
    setSkipResistOnGrab(false);
    setDialogueText(null);
    setBehaviorState("idle");
    setAction("idle");
  }, []);

  const startDialogue = useCallback((text: string) => {
    if (isMutedRef.current) {
      return;
    }

    const currentState = behaviorStateRef.current;
    if (
      currentState !== "idle" &&
      currentState !== "walking" &&
      currentState !== "climbing" &&
      currentState !== "sitting" &&
      currentState !== "dialoguing"
    ) {
      return;
    }

    unfreeze();

    if (currentState !== "dialoguing") {
      dialogueReturnStateRef.current =
        currentState === "sitting" ? "sitting" : "idle";

      // dialogue during an auto-sit should not snap back into a timed auto-sit
      if (currentState === "sitting" && sittingModeRef.current === "auto") {
        sittingModeRef.current = "manual";
      }
    }

    // clears any in-progress walk/climb targets so movement stops immediately
    targetXRef.current = null;
    targetYRef.current = null;
    setDialogueText(text);
    setBehaviorState("dialoguing");
    setAction(
      dialogueReturnStateRef.current === "sitting" ? "sit" : "idle",
    );
  }, [unfreeze]);

  const dismissDialogue = useCallback(() => {
    if (behaviorStateRef.current !== "dialoguing") {
      return;
    }

    setDialogueText(null);

    if (dialogueReturnStateRef.current === "sitting") {
      setBehaviorState("sitting");
      setAction(sittingActionRef.current);
      return;
    }

    setBehaviorState("idle");
    setAction("idle");
  }, []);

  useEffect(() => {
    if (isMuted) {
      dismissDialogue();
    }
  }, [dismissDialogue, isMuted]);

  const startSitting = useCallback(
    (mode: "manual" | "auto", requestedAction?: CompanionAction) => {
      targetXRef.current = null;
      setDialogueText(null);
      sittingModeRef.current = mode;
      const sitAction = requestedAction ?? registry.pickFloorSitAction() ?? "sit";
      sittingActionRef.current = sitAction;
      setBehaviorState("sitting");
      setAction(sitAction);
    },
    [registry],
  );

  const toggleSit = useCallback(() => {
    const currentState = behaviorStateRef.current;

    if (currentState === "sitting") {
      unfreeze();
      returnToIdle();
      return;
    }

    if (
      currentState !== "idle" &&
      currentState !== "walking" &&
      currentState !== "dialoguing"
    ) {
      return;
    }

    unfreeze();
    startSitting("manual");
  }, [returnToIdle, startSitting, unfreeze]);

  const playMenuAnimation = useCallback(
    (nextAction: CompanionMenuAnimationAction) => {
      const currentState = behaviorStateRef.current;
      if (
        currentState !== "idle" &&
        currentState !== "walking" &&
        currentState !== "sitting" &&
        currentState !== "dialoguing" &&
        currentState !== "emoting"
      ) {
        return;
      }

      unfreeze();

      if (
        nextAction === "sit" ||
        nextAction === "sitAlt" ||
        nextAction === "sitAlt2" ||
        nextAction === "sitOnBar" ||
        nextAction === "dangleOnBar"
      ) {
        startSitting("manual", nextAction);
        return;
      }

      targetXRef.current = null;
      targetYRef.current = null;
      sittingModeRef.current = null;
      setDialogueText(null);
      setBehaviorState("emoting");
      setAction(nextAction);
    },
    [startSitting, unfreeze],
  );

  useEffect(() => {
    if (behaviorState !== "dialoguing" || dialogueText === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dismissDialogue();
    }, DIALOGUE_DISPLAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [behaviorState, dialogueText, dismissDialogue]);

  const handleSurfaceLockLost = useCallback(() => {
    const currentState = behaviorStateRef.current;
    if (
      currentState === "dragging" ||
      currentState === "falling" ||
      currentState === "bouncing"
    ) {
      return;
    }

    targetXRef.current = null;
    targetYRef.current = null;
    setFallVelocity({ x: 0, y: 2 });
    setBehaviorState("falling");
    setAction("fall");
  }, []);

  useEffect(() => {
    handleSurfaceLockLostRef.current = handleSurfaceLockLost;
  }, [handleSurfaceLockLost]);

  const clearTitleBarLockHint = useCallback(() => {
    snapHintProbeRef.current += 1;
    pendingSnapHintAnchorRef.current = null;
    if (snapHoverTimeoutRef.current !== null) {
      window.clearTimeout(snapHoverTimeoutRef.current);
      snapHoverTimeoutRef.current = null;
    }
    snapHoverTargetRef.current = null;
    qualifiedSnapTargetRef.current = null;
    setShowTitleBarLockHint(false);
  }, []);

  const updateSnapHoverTarget = useCallback((target: SurfaceLock | null) => {
    if (isSameSurfaceLock(snapHoverTargetRef.current, target)) {
      return;
    }

    if (snapHoverTimeoutRef.current !== null) {
      window.clearTimeout(snapHoverTimeoutRef.current);
      snapHoverTimeoutRef.current = null;
    }

    snapHoverTargetRef.current = target;
    qualifiedSnapTargetRef.current = null;
    setShowTitleBarLockHint(false);

    if (!target) {
      return;
    }

    const probeVersion = snapHintProbeRef.current;
    snapHoverTimeoutRef.current = window.setTimeout(() => {
      snapHoverTimeoutRef.current = null;

      if (
        snapHintProbeRef.current === probeVersion &&
        isDraggingRef.current &&
        isSameSurfaceLock(snapHoverTargetRef.current, target)
      ) {
        qualifiedSnapTargetRef.current = target;
        setShowTitleBarLockHint(true);
      }
    }, SNAP_HOVER_DURATION_MS);
  }, []);

  const lockToWallAndIdle = useCallback(
    async (lock: SurfaceLock) => {
      targetXRef.current = null;
      targetYRef.current = null;
      const anchor = getAnchorPosition();
      await setAnchorPosition(anchor, "locked");

      if (isScreenEdgeHwnd(lock.hwnd)) {
        setFacing(lock.kind === "wallLeft" ? "left" : "right");
      } else {
        setFacing(lock.kind === "wallLeft" ? "right" : "left");
      }

      setBehaviorState("idle");
      setAction("idle");
    },
    [getAnchorPosition, setAnchorPosition],
  );

  const lockToUndersideAndIdle = useCallback(async () => {
    targetXRef.current = null;
    targetYRef.current = null;
    const anchor = getAnchorPosition();
    await setAnchorPosition(anchor, "locked");
    setBehaviorState("idle");
    setAction("idle");
  }, [getAnchorPosition, setAnchorPosition]);

  const runSnapHintProbe = useCallback(
    () => {
      if (snapHintProbeInFlightRef.current) {
        return;
      }

      const anchor = pendingSnapHintAnchorRef.current;
      if (!anchor) {
        return;
      }

      pendingSnapHintAnchorRef.current = null;
      snapHintProbeInFlightRef.current = true;
      const probeVersion = snapHintProbeRef.current;

      void getSurfaceLockAt(anchor.x, anchor.y)
        .then((lock) => {
          if (
            snapHintProbeRef.current === probeVersion &&
            isDraggingRef.current
          ) {
            updateSnapHoverTarget(lock);
          }
        })
        .finally(() => {
          snapHintProbeInFlightRef.current = false;

          if (pendingSnapHintAnchorRef.current) {
            window.requestAnimationFrame(() => {
              runSnapHintProbeRef.current();
            });
          }
        });
    },
    [getSurfaceLockAt, updateSnapHoverTarget],
  );
  runSnapHintProbeRef.current = runSnapHintProbe;

  const handleDragMove = useCallback((anchor: ScreenPosition) => {
    pendingSnapHintAnchorRef.current = anchor;
    runSnapHintProbeRef.current();
  }, []);

  useEffect(() => {
    return () => {
      snapHintProbeRef.current += 1;
      pendingSnapHintAnchorRef.current = null;
      if (snapHoverTimeoutRef.current !== null) {
        window.clearTimeout(snapHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleDragStart = useCallback(() => {
    unfreeze();

    const currentState = behaviorStateRef.current;
    const wasFalling = currentState === "falling";

    targetXRef.current = null;
    targetYRef.current = null;
    isDraggingRef.current = true;
    sittingModeRef.current = null;
    releaseSurfaceLockForDrag();
    clearTitleBarLockHint();
    setDialogueText(null);

    if (wasFalling) {
      setFallVelocity({ x: 0, y: 0 });
      setSkipResistOnGrab(true);
      setBehaviorState("dragging");
      setAction("grabbed");
      return;
    }

    setSkipResistOnGrab(false);
    setBehaviorState("dragging");
    setAction("resist");
  }, [clearTitleBarLockHint, releaseSurfaceLockForDrag, unfreeze]);

  const handleResistEnd = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    setAction("grabbed");
  }, []);

  const handleDragEnd = useCallback(
    ({
      throwVelocity: releaseVelocity,
      anchor,
    }: {
      throwVelocity: FallVelocity;
      anchor: { x: number; y: number };
    }) => {
      isDraggingRef.current = false;
      const qualifiedSnapTarget = qualifiedSnapTargetRef.current;
      setSkipResistOnGrab(false);
      clearTitleBarLockHint();

      void (async () => {
        const locked = qualifiedSnapTarget
          ? await tryLockSurfaceAt(
              anchor.x,
              anchor.y,
              qualifiedSnapTarget,
            )
          : null;

        if (locked?.kind === "titleBar") {
          const floorY = getFloorYAt(anchor.x, anchor.y);
          await setAnchorPosition(
            { x: clampAnchorX(anchor.x), y: floorY },
            "grounded",
          );
          startBounce();
          return;
        }

        if (locked?.kind === "wallLeft" || locked?.kind === "wallRight") {
          await lockToWallAndIdle(locked);
          return;
        }

        if (locked?.kind === "underside") {
          await lockToUndersideAndIdle();
          return;
        }

        const floorY = getFloorYAt(anchor.x, anchor.y);

        if (anchor.y >= floorY - LANDING_THRESHOLD) {
          await setAnchorPosition({ x: anchor.x, y: floorY }, "grounded");
          startBounce();
          return;
        }

        setFallVelocity(releaseVelocity);
        setBehaviorState("falling");
        setAction("fall");
      })();
    },
    [
      clampAnchorX,
      clearTitleBarLockHint,
      getFloorYAt,
      setAnchorPosition,
      startBounce,
      tryLockSurfaceAt,
      lockToWallAndIdle,
      lockToUndersideAndIdle,
    ],
  );

  const dragEnabled =
    isReady &&
    (behaviorState === "idle" ||
      behaviorState === "walking" ||
      behaviorState === "climbing" ||
      behaviorState === "sitting" ||
      behaviorState === "emoting" ||
      behaviorState === "dialoguing" ||
      behaviorState === "falling" ||
      behaviorState === "bouncing");

  const { grabbedLeanTier, onPointerDown } = useCompanionDrag({
    isEnabled: dragEnabled,
    skipResistDelay: skipResistOnGrab,
    grabOffset: {
      x:
        (registry.getSpriteAnchor("idle").x - registry.spriteWidth / 2) *
        scale,
      y:
        (registry.getSpriteAnchor("idle").y - registry.spriteHeight / 4) *
        scale,
    },
    getAnchorPosition,
    setAnchorPosition,
    onDragStart: handleDragStart,
    onResistEnd: handleResistEnd,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  });

  useCompanionFall({
    isActive: behaviorState === "falling",
    initialVelocity: fallVelocity,
    getFloorYAt,
    clampToWalls,
    getAnchorPosition,
    onPositionChange: (position) => {
      void setAnchorPosition(position, "walls");
    },
    onLand: () => {
      const anchor = getAnchorPosition();
      const floorY = getFloorYAt(anchor.x, anchor.y);

      startBounce();
      void setAnchorPosition({ x: anchor.x, y: floorY }, "grounded");
    },
  });

  const startWalkingTo = useCallback((targetX: number, canAttach = true) => {
    const currentX = anchorXRef.current;
    const direction: FacingDirection = targetX >= currentX ? "right" : "left";

    sittingModeRef.current = null;
    targetYRef.current = null;
    targetXRef.current = targetX;
    walkingCanAttachRef.current = canAttach;
    setFacing(direction);
    setBehaviorState("walking");
    setAction("walk");
  }, []);

  const startFloorCrawlingTo = useCallback((targetX: number) => {
    const currentX = anchorXRef.current;
    const direction: FacingDirection = targetX >= currentX ? "right" : "left";

    sittingModeRef.current = null;
    targetYRef.current = null;
    targetXRef.current = targetX;
    walkingCanAttachRef.current = false;
    setFacing(direction);
    setBehaviorState("walking");
    setAction("floorCrawl");
  }, []);

  const startCrawlingTo = useCallback((targetX: number) => {
    const currentX = anchorXRef.current;
    const direction: FacingDirection = targetX >= currentX ? "right" : "left";

    sittingModeRef.current = null;
    targetYRef.current = null;
    targetXRef.current = targetX;
    setFacing(direction);
    setBehaviorState("walking");
    setAction("climbCeiling");
  }, []);

  const startClimbingTo = useCallback((targetY: number) => {
    const currentY = anchorYRef.current;

    targetXRef.current = null;
    targetYRef.current = targetY;
    setBehaviorState("climbing");
    setAction(targetY < currentY ? "climbWall" : "climbWallDown");
  }, []);

  const toggleFreeze = useCallback(() => {
    setIsFrozen((current) => !current);
  }, []);

  const turnAround = useCallback(() => {
    const currentState = behaviorStateRef.current;
    if (
      isWallLockedRef.current ||
      isUndersideLockedRef.current ||
      currentState === "walking" ||
      currentState === "climbing" ||
      currentState === "dragging" ||
      currentState === "falling" ||
      currentState === "bouncing"
    ) {
      return;
    }

    unfreeze();
    setFacing((current) => (current === "left" ? "right" : "left"));
  }, [unfreeze]);

  const walkToAnchorX = useCallback(
    (screenX: number) => {
      unfreeze();

      if (isWallLockedRef.current || isUndersideLockedRef.current) {
        return;
      }

      const currentState = behaviorStateRef.current;
      if (
        currentState === "dragging" ||
        currentState === "falling" ||
        currentState === "bouncing" ||
        currentState === "climbing"
      ) {
        return;
      }

      if (currentState === "dialoguing") {
        setDialogueText(null);
      }

      targetYRef.current = null;

      const targetX = clampAnchorX(screenX);
      startWalkingTo(targetX);
    },
    [clampAnchorX, startWalkingTo, unfreeze],
  );

  const floorCrawlToAnchorX = useCallback(
    (screenX: number) => {
      unfreeze();

      if (
        isWallLockedRef.current ||
        isUndersideLockedRef.current ||
        !registry.canFloorCrawl
      ) {
        return;
      }

      const currentState = behaviorStateRef.current;
      if (
        currentState === "dragging" ||
        currentState === "falling" ||
        currentState === "bouncing" ||
        currentState === "climbing"
      ) {
        return;
      }

      if (currentState === "dialoguing") {
        setDialogueText(null);
      }

      targetYRef.current = null;

      const targetX = clampAnchorX(screenX);
      startFloorCrawlingTo(targetX);
    },
    [clampAnchorX, registry.canFloorCrawl, startFloorCrawlingTo, unfreeze],
  );

  const crawlToAnchorX = useCallback(
    (screenX: number) => {
      unfreeze();

      if (!isUndersideLockedRef.current) {
        return;
      }

      const currentState = behaviorStateRef.current;
      if (
        currentState === "dragging" ||
        currentState === "falling" ||
        currentState === "bouncing" ||
        currentState === "climbing"
      ) {
        return;
      }

      if (currentState === "dialoguing") {
        setDialogueText(null);
      }

      targetYRef.current = null;

      const targetX = clampAnchorX(screenX);
      startCrawlingTo(targetX);
    },
    [clampAnchorX, startCrawlingTo, unfreeze],
  );

  const climbToAnchorY = useCallback(
    (screenY: number) => {
      unfreeze();

      if (!isWallLockedRef.current) {
        return;
      }

      const currentState = behaviorStateRef.current;
      if (
        currentState === "dragging" ||
        currentState === "falling" ||
        currentState === "bouncing" ||
        currentState === "walking"
      ) {
        return;
      }

      if (currentState === "dialoguing") {
        setDialogueText(null);
      }

      const range = getVerticalClimbRange();
      if (!range) {
        return;
      }

      targetXRef.current = null;

      const targetY = Math.min(
        range.maxY,
        Math.max(range.minY, screenY),
      );

      if (Math.abs(targetY - anchorYRef.current) < 8) {
        return;
      }

      startClimbingTo(targetY);
    },
    [getVerticalClimbRange, startClimbingTo, unfreeze],
  );

  const pickWalkTarget = useCallback(() => {
    const range = getHorizontalWalkRange();
    if (!range) {
      return null;
    }

    const { minX, maxX } = range;
    let nextTarget = clampAnchorX(randomBetween(minX, maxX));

    if (Math.abs(nextTarget - anchorXRef.current) < MIN_WALK_DISTANCE) {
      const alternate = nextTarget > anchorXRef.current ? minX : maxX;
      nextTarget = clampAnchorX(alternate);
    }

    if (Math.abs(nextTarget - anchorXRef.current) < MIN_WALK_DISTANCE) {
      return null;
    }

    return nextTarget;
  }, [clampAnchorX, getHorizontalWalkRange]);

  useEffect(() => {
    if (
      !isReady ||
      behaviorState !== "idle" ||
      isWallLocked ||
      isUndersideLocked ||
      isFrozen ||
      (!behaviorSettingsRef.current.allowRandomWalk &&
        (!behaviorSettingsRef.current.allowRandomFloorCrawl ||
          !registry.canFloorCrawl) &&
        !behaviorSettingsRef.current.allowRandomSit) ||
      behaviorSettingsRef.current.actionFrequency <= 0 ||
      (!behaviorSettingsRef.current.walkFrequency &&
        !behaviorSettingsRef.current.floorCrawlFrequency &&
        !behaviorSettingsRef.current.sitFrequency)
    ) {
      return;
    }

    const actionFrequency = behaviorSettingsRef.current.actionFrequency;

    const timeoutId = window.setTimeout(() => {
      if (behaviorStateRef.current !== "idle" || isFrozenRef.current) {
        return;
      }

      const canSit = behaviorSettingsRef.current.allowRandomSit;
      const canWalk = behaviorSettingsRef.current.allowRandomWalk;
      const canFloorCrawl =
        behaviorSettingsRef.current.allowRandomFloorCrawl &&
        registry.canFloorCrawl;
      const randomSitAction = registry.pickFloorSitAction(
        behaviorSettingsRef.current.randomSitActions,
      );
      const crawlTarget = canFloorCrawl ? pickWalkTarget() : null;
      const walkTarget = canWalk ? pickWalkTarget() : null;
      const nextAction = pickWeightedAction([
        {
          value: "floorCrawl" as const,
          weight: crawlTarget === null
            ? 0
            : behaviorSettingsRef.current.floorCrawlFrequency,
        },
        {
          value: "sit" as const,
          weight:
            !canSit || randomSitAction === null
              ? 0
              : behaviorSettingsRef.current.sitFrequency,
        },
        {
          value: "walk" as const,
          weight: walkTarget === null
            ? 0
            : behaviorSettingsRef.current.walkFrequency,
        },
      ]);

      if (nextAction === "floorCrawl" && crawlTarget !== null) {
        startFloorCrawlingTo(crawlTarget);
        return;
      }

      if (nextAction === "sit" && randomSitAction !== null) {
        startSitting("auto", randomSitAction);
        return;
      }

      if (nextAction === "walk" && walkTarget !== null) {
        startWalkingTo(walkTarget, false);
      }
    }, randomIdleDelay(actionFrequency));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    behaviorState,
    isFrozen,
    isReady,
    isUndersideLocked,
    isWallLocked,
    pickWalkTarget,
    registry,
    startFloorCrawlingTo,
    startSitting,
    startWalkingTo,
    normalizedBehaviorSettings,
  ]);

  // once manually attached to a wall, keep normal autonomous wall movement
  useEffect(() => {
    if (
      !isReady ||
      behaviorState !== "idle" ||
      !isWallLocked ||
      isFrozen ||
      !behaviorSettingsRef.current.allowRandomWallClimb ||
      behaviorSettingsRef.current.actionFrequency <= 0 ||
      behaviorSettingsRef.current.wallClimbFrequency <= 0
    ) {
      return;
    }

    const actionFrequency =
      behaviorSettingsRef.current.actionFrequency *
      behaviorSettingsRef.current.wallClimbFrequency;

    const timeoutId = window.setTimeout(() => {
      if (behaviorStateRef.current !== "idle" || isFrozenRef.current) {
        return;
      }

      const range = getVerticalClimbRange();
      if (!range) {
        return;
      }

      let nextTarget = randomBetween(range.minY, range.maxY);

      if (Math.abs(nextTarget - anchorYRef.current) < 48) {
        nextTarget =
          nextTarget >= anchorYRef.current ? range.minY : range.maxY;
      }

      if (Math.abs(nextTarget - anchorYRef.current) < 48) {
        return;
      }

      startClimbingTo(nextTarget);
    }, randomIdleDelay(actionFrequency));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    behaviorState,
    getVerticalClimbRange,
    isFrozen,
    isReady,
    isWallLocked,
    normalizedBehaviorSettings,
    startClimbingTo,
  ]);

  // window bottom crawl — horizontal autonomous moves
  useEffect(() => {
    if (
      !isReady ||
      behaviorState !== "idle" ||
      !isUndersideLocked ||
      isFrozen ||
      !behaviorSettingsRef.current.allowRandomCeilingCrawl ||
      behaviorSettingsRef.current.actionFrequency <= 0 ||
      behaviorSettingsRef.current.ceilingCrawlFrequency <= 0
    ) {
      return;
    }

    const actionFrequency =
      behaviorSettingsRef.current.actionFrequency *
      behaviorSettingsRef.current.ceilingCrawlFrequency;

    const timeoutId = window.setTimeout(() => {
      if (
        behaviorStateRef.current !== "idle" ||
        isFrozenRef.current ||
        !isUndersideLockedRef.current
      ) {
        return;
      }

      const target = pickWalkTarget();
      if (target === null) {
        return;
      }

      startCrawlingTo(target);
    }, randomIdleDelay(actionFrequency));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    behaviorState,
    isFrozen,
    isReady,
    isUndersideLocked,
    normalizedBehaviorSettings,
    pickWalkTarget,
    startCrawlingTo,
  ]);

  // auto sit eventually stands back up; manual sit stays until the user toggles it
  useEffect(() => {
    if (
      behaviorState !== "sitting" ||
      sittingModeRef.current !== "auto" ||
      isFrozen
    ) {
      return;
    }

    const sitDurationMs = randomBetween(
      MIN_AUTONOMOUS_SIT_MS,
      MAX_AUTONOMOUS_SIT_MS,
    );

    const timeoutId = window.setTimeout(() => {
      if (
        behaviorStateRef.current === "sitting" &&
        sittingModeRef.current === "auto"
      ) {
        returnToIdle();
      }
    }, sitDurationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [behaviorState, isFrozen, returnToIdle]);

  useAutonomousDialogue({
    isEnabled: normalizedBehaviorSettings.allowRandomDialogue,
    isReady,
    isFrozen,
    isFrozenRef,
    behaviorState,
    behaviorStateRef,
    startDialogue,
    characterId,
    frequency: normalizedBehaviorSettings.dialogueFrequency,
    dialogueSettings,
    isMuted,
  });

  const finishClimbing = useCallback(
    async (targetY: number) => {
      targetYRef.current = null;
      const current = getAnchorPosition();
      await setAnchorPosition({ x: current.x, y: targetY }, "locked");
      setBehaviorState("idle");
      setAction("idle");
    },
    [getAnchorPosition, setAnchorPosition],
  );

  const finishWalking = useCallback(
    async (targetX: number) => {
      targetXRef.current = null;
      await setAnchorX(targetX);
      setBehaviorState("idle");
      setAction("idle");
    },
    [setAnchorX],
  );

  const tryFinishWalkAtWall = useCallback(
    async (fallbackX: number) => {
      if (
        isUndersideLockedRef.current ||
        !walkingCanAttachRef.current
      ) {
        await finishWalking(fallbackX);
        return;
      }

      const anchor = getAnchorPosition();
      const locked = await tryLockSurfaceAt(anchor.x, anchor.y);

      if (locked && isWallLock(locked.kind)) {
        await lockToWallAndIdle(locked);
        return;
      }

      await finishWalking(fallbackX);
    },
    [finishWalking, getAnchorPosition, lockToWallAndIdle, tryLockSurfaceAt],
  );

  const onClimbTick = useCallback(
    (deltaY: number) => {
      if (behaviorState !== "climbing" || targetYRef.current === null) {
        return;
      }

      const currentY = anchorYRef.current;
      const targetY = targetYRef.current;
      const direction = targetY < currentY ? -1 : 1;
      const adjustedDelta =
        Math.abs(deltaY) *
        direction *
        behaviorSettingsRef.current.movementSpeed *
        MOVEMENT_SPEED_SCALE;
      const nextY = currentY + adjustedDelta;
      const reachedTarget =
        (direction < 0 && nextY <= targetY) ||
        (direction > 0 && nextY >= targetY);

      if (reachedTarget) {
        void finishClimbing(targetY);
        return;
      }

      const moved = moveByY(adjustedDelta);
      if (!moved) {
        void finishClimbing(currentY);
      }
    },
    [behaviorState, finishClimbing, moveByY],
  );

  const onWalkTick = useCallback(
    (deltaX: number) => {
      if (behaviorState !== "walking" || targetXRef.current === null) {
        return;
      }

      const adjustedDelta =
        deltaX *
        behaviorSettingsRef.current.movementSpeed *
        MOVEMENT_SPEED_SCALE;
      const currentX = anchorXRef.current;
      const targetX = targetXRef.current;
      const nextX = currentX + adjustedDelta;
      const reachedTarget =
        (facing === "right" && nextX >= targetX) ||
        (facing === "left" && nextX <= targetX);

      if (reachedTarget) {
        void tryFinishWalkAtWall(clampAnchorX(targetX));
        return;
      }

      const moved = moveBy(adjustedDelta);
      if (!moved) {
        void tryFinishWalkAtWall(clampAnchorX(currentX));
      }
    },
    [
      behaviorState,
      clampAnchorX,
      facing,
      moveBy,
      tryFinishWalkAtWall,
    ],
  );

  const onAnimationCycleComplete = useCallback(
    (completedAction: CompanionAction) => {
      const currentState = behaviorStateRef.current;
      if (
        (completedAction === "bounce" && currentState === "bouncing") ||
        (completedAction.startsWith("emote") && currentState === "emoting")
      ) {
        returnToIdle();
      }
    },
    [returnToIdle],
  );

  const canOpenContextMenu = useMemo(
    () =>
      isReady &&
      (behaviorState === "idle" ||
        behaviorState === "walking" ||
        behaviorState === "climbing" ||
        behaviorState === "sitting" ||
        behaviorState === "emoting" ||
        behaviorState === "dialoguing" ||
        behaviorState === "falling"),
    [behaviorState, isReady],
  );

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();

      if (!canOpenContextMenu) {
        return;
      }

      const pointer = toPhysicalScreenPosition(event.screenX, event.screenY);
      void showCompanionMenu(
        pointer.x,
        pointer.y,
        isWallLocked,
        isUndersideLocked,
        isFrozen,
        isMuted,
        registry.canFloorCrawl,
        registry.contextMenuActions,
      );
    },
    [
      canOpenContextMenu,
      isFrozen,
      isMuted,
      isUndersideLocked,
      isWallLocked,
      registry.canFloorCrawl,
      registry.contextMenuActions,
    ],
  );

  return {
    action,
    displayAction,
    facing,
    behaviorState,
    dialogueText,
    isReady,
    showTitleBarLockHint,
    wallSide,
    grabbedLeanTier,
    getAnchorPosition,
    setAnchorPosition,
    onWalkTick,
    onClimbTick,
    onAnimationCycleComplete,
    onPointerDown,
    startDialogue,
    dismissDialogue,
    toggleSit,
    playMenuAnimation,
    turnAround,
    walkToAnchorX,
    floorCrawlToAnchorX,
    crawlToAnchorX,
    climbToAnchorY,
    isFrozen,
    toggleFreeze,
    unfreeze,
    canOpenContextMenu,
    onContextMenu,
  };
}
