import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { useCharacterAnimationRegistry } from "../../hooks/useCharacterAnimationRegistry";
import { useCompanionAnimation } from "../../hooks/useCompanionAnimation";
import { useCompanionBackgroundEvents } from "../../hooks/useCompanionBackgroundEvents";
import { useCompanionBehavior } from "../../hooks/useCompanionBehavior";
import { useCompanionDialogueEvents } from "../../hooks/useCompanionDialogueEvents";
import { useCompanionFreezeEvents } from "../../hooks/useCompanionFreezeEvents";
import { useCompanionInstances } from "../../hooks/useCompanionInstances";
import { useCompanionMenuEvents } from "../../hooks/useCompanionMenuEvents";
import { useCompanionMirrorBroadcast } from "../../hooks/useCompanionMirrorBroadcast";
import { useCompanionSitEvents } from "../../hooks/useCompanionSitEvents";
import { useCompanionWalkPickerEvents } from "../../hooks/useCompanionWalkPickerEvents";
import { useCompanionWindowSurfaces } from "../../hooks/useCompanionWindowSurfaces";
import type { AnimationRegistry } from "../../services/animationRegistry";
import {
  setCompanionOverlayHitRegions,
  type CompanionOverlayHitRegion,
} from "../../services/companionApi";
import {
  duplicateTemporaryInstance,
  setInstanceEnabled,
  updateInstance,
} from "../../services/companionInstanceManager";
import type { WindowSurface } from "../../types/companion";
import type { CompanionInstance } from "../../types/companionInstance";
import { CompanionSpeechBubble } from "./CompanionSpeechBubble";
import { CompanionSprite } from "./CompanionSprite";
import { CompanionSurfaceLockIndicator } from "./CompanionSurfaceLockIndicator";

const SPEECH_REGION_TOP_PAD = 80;
const SPEECH_REGION_SIDE_PAD = 40;

type HitRegionUpdate = (
  id: string,
  region: CompanionOverlayHitRegion | null,
  isDragging: boolean,
) => void;

function useOverlayHitRegions(): HitRegionUpdate {
  const regionsRef = useRef(
    new Map<string, { region: CompanionOverlayHitRegion; isDragging: boolean }>(),
  );
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    const entries = [...regionsRef.current.values()];
    const captureAll = entries.some((entry) => entry.isDragging);
    void setCompanionOverlayHitRegions(
      entries.map((entry) => entry.region),
      captureAll,
    );
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(flush);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      void setCompanionOverlayHitRegions([], false);
    };
  }, []);

  return useCallback(
    (id, region, isDragging) => {
      if (region === null) {
        regionsRef.current.delete(id);
      } else {
        regionsRef.current.set(id, { region, isDragging });
      }

      schedule();
    },
    [schedule],
  );
}

interface CompanionActorProps {
  instance: CompanionInstance;
  sharedSurfaces: WindowSurface[];
  sharedSurfacesRef: RefObject<WindowSurface[]>;
  onHitRegionChange: HitRegionUpdate;
}

function CompanionActor({
  instance,
  sharedSurfaces,
  sharedSurfacesRef,
  onHitRegionChange,
}: CompanionActorProps) {
  const registry = useCharacterAnimationRegistry(instance.characterId);

  if (!registry) {
    return null;
  }

  return (
    <CompanionActorInner
      instance={instance}
      registry={registry}
      sharedSurfaces={sharedSurfaces}
      sharedSurfacesRef={sharedSurfacesRef}
      onHitRegionChange={onHitRegionChange}
    />
  );
}

interface CompanionActorInnerProps extends CompanionActorProps {
  registry: AnimationRegistry;
}

function CompanionActorInner({
  instance,
  registry,
  sharedSurfaces,
  sharedSurfacesRef,
  onHitRegionChange,
}: CompanionActorInnerProps) {
  const effectiveScale = instance.scale * registry.baseDisplayScale;

  const toggleMute = useCallback(() => {
    void updateInstance(instance.id, { muted: instance.muted !== true });
  }, [instance.id, instance.muted]);

  const turnOff = useCallback(() => {
    void setInstanceEnabled(instance.id, false);
  }, [instance.id]);

  const duplicate = useCallback(() => {
    void duplicateTemporaryInstance(instance.id);
  }, [instance.id]);

  const {
    displayAction,
    desktopBounds,
    anchorX,
    anchorY,
    anchorXOffset,
    anchorYOffset,
    facing,
    wallSide,
    behaviorState,
    dialogueText,
    isReady,
    showTitleBarLockHint,
    grabbedLeanTier,
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
    onContextMenu,
  } = useCompanionBehavior({
    registry,
    characterId: instance.characterId,
    scale: effectiveScale,
    initialAnchor: instance.position,
    dialogueSettings: instance.dialogueSettings,
    behaviorSettings: instance.behaviorSettings,
    isMuted: instance.muted === true,
    instanceId: instance.id,
    positionMode: "overlay",
    sharedSurfaces,
    sharedSurfacesRef,
  });

  const backgroundMode = useCompanionBackgroundEvents();

  useCompanionDialogueEvents({
    instanceId: instance.id,
    startDialogue,
    dismissDialogue,
  });
  useCompanionSitEvents({ instanceId: instance.id, toggleSit });
  useCompanionFreezeEvents({ instanceId: instance.id, toggleFreeze });
  useCompanionMenuEvents({
    instanceId: instance.id,
    onTurnAround: turnAround,
    onPlayAnimation: playMenuAnimation,
    onToggleFreeze: toggleFreeze,
    onToggleMute: toggleMute,
    onDuplicate: duplicate,
    onTurnOff: turnOff,
    onUnfreeze: unfreeze,
  });
  useCompanionWalkPickerEvents({
    instanceId: instance.id,
    onSelectWalkTarget: walkToAnchorX,
    onSelectFloorCrawlTarget: floorCrawlToAnchorX,
    onSelectCrawlTarget: crawlToAnchorX,
    onSelectClimbTarget: climbToAnchorY,
    onCancel: () => {},
  });

  const { frameSrc } = useCompanionAnimation({
    registry,
    action: displayAction,
    facing,
    grabbedLeanTier,
    onTick: onWalkTick,
    onClimbTick,
    onAnimationCycleComplete,
  });

  useCompanionMirrorBroadcast({
    instanceId: instance.id,
    action: displayAction,
    facing,
    grabbedLeanTier,
    isDragging: behaviorState === "dragging",
    behaviorState,
    dialogueText,
    isFrozen,
  });

  const width = registry.spriteWidth * effectiveScale;
  const height = registry.spriteHeight * effectiveScale;
  const virtualLeft = desktopBounds?.virtualLeft ?? 0;
  const virtualTop = desktopBounds?.virtualTop ?? 0;
  const left = anchorX - anchorXOffset - virtualLeft;
  const top = anchorY - anchorYOffset - virtualTop;
  const isDragging = behaviorState === "dragging";

  useEffect(() => {
    if (!isReady) {
      onHitRegionChange(instance.id, null, false);
      return;
    }

    const speechTopPad = dialogueText === null ? 0 : SPEECH_REGION_TOP_PAD;
    const speechSidePad = dialogueText === null ? 0 : SPEECH_REGION_SIDE_PAD;

    onHitRegionChange(
      instance.id,
      {
        x: left - speechSidePad,
        y: top - speechTopPad,
        width: width + speechSidePad * 2,
        height: height + speechTopPad,
      },
      isDragging,
    );

    return () => {
      onHitRegionChange(instance.id, null, false);
    };
  }, [
    dialogueText,
    height,
    instance.id,
    isDragging,
    isReady,
    left,
    onHitRegionChange,
    top,
    width,
  ]);

  if (!isReady) {
    return null;
  }

  return (
    <div
      className={`absolute overflow-visible ${
        backgroundMode === "gray" ? "bg-neutral-600/45" : "bg-transparent"
      }`}
      style={{
        left,
        top,
        width,
        height,
      }}
    >
      {dialogueText !== null ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2">
          <CompanionSpeechBubble text={dialogueText} />
        </div>
      ) : null}

      <CompanionSurfaceLockIndicator
        visible={showTitleBarLockHint && behaviorState === "dragging"}
      />
      <CompanionSprite
        frameSrc={frameSrc}
        facing={facing}
        action={displayAction}
        wallSide={wallSide}
        isDragging={isDragging}
        scale={effectiveScale}
        spriteWidth={registry.spriteWidth}
        spriteHeight={registry.spriteHeight}
        spriteAnchor={registry.getSpriteAnchor(displayAction)}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

export function CompanionOverlayWindow() {
  const { instances } = useCompanionInstances();
  const visibleInstances = useMemo(
    () => instances.filter((instance) => instance.enabled && !instance.archived),
    [instances],
  );
  const { surfaces, surfacesRef } = useCompanionWindowSurfaces(
    visibleInstances.length > 0,
  );
  const updateHitRegion = useOverlayHitRegions();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      {visibleInstances.map((instance) => (
        <CompanionActor
          key={instance.id}
          instance={instance}
          sharedSurfaces={surfaces}
          sharedSurfacesRef={surfacesRef}
          onHitRegionChange={updateHitRegion}
        />
      ))}
    </div>
  );
}
