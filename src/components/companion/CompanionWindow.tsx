import { useCallback } from "react";
import { useCompanionAnimation } from "../../hooks/useCompanionAnimation";
import { useCompanionBackgroundEvents } from "../../hooks/useCompanionBackgroundEvents";
import { useCompanionBehavior } from "../../hooks/useCompanionBehavior";
import { useCompanionDialogueEvents } from "../../hooks/useCompanionDialogueEvents";
import { useCompanionFreezeEvents } from "../../hooks/useCompanionFreezeEvents";
import { useCompanionInstanceConfig } from "../../hooks/useCompanionInstanceConfig";
import { useCompanionMenuEvents } from "../../hooks/useCompanionMenuEvents";
import { useCompanionSitEvents } from "../../hooks/useCompanionSitEvents";
import { useCompanionWalkPickerEvents } from "../../hooks/useCompanionWalkPickerEvents";
import { useCompanionMirrorBroadcast } from "../../hooks/useCompanionMirrorBroadcast";
import { useCompanionSpeechWindow } from "../../hooks/useCompanionSpeechWindow";
import { useCompanionWindowSizeSync } from "../../hooks/useCompanionWindowSizeSync";
import type { AnimationRegistry } from "../../services/animationRegistry";
import {
  duplicateTemporaryInstance,
  setInstanceEnabled,
  updateInstance,
} from "../../services/companionInstanceManager";
import type { CompanionInstance } from "../../types/companionInstance";
import { CompanionSprite } from "./CompanionSprite";
import { CompanionSurfaceLockIndicator } from "./CompanionSurfaceLockIndicator";

interface CompanionWindowInnerProps {
  instance: CompanionInstance;
  registry: AnimationRegistry;
}

function CompanionWindowInner({ instance, registry }: CompanionWindowInnerProps) {
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
    facing,
    wallSide,
    behaviorState,
    dialogueText,
    isReady,
    showTitleBarLockHint,
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
    onContextMenu,
  } = useCompanionBehavior({
    registry,
    characterId: instance.characterId,
    scale: instance.scale,
    initialAnchor: instance.position,
    dialogueSettings: instance.dialogueSettings,
    behaviorSettings: instance.behaviorSettings,
    isMuted: instance.muted === true,
  });

  useCompanionWindowSizeSync({
    instance,
    registry,
    isReady,
    getAnchorPosition,
    setAnchorPosition,
  });

  const backgroundMode = useCompanionBackgroundEvents();

  useCompanionDialogueEvents({ startDialogue, dismissDialogue });
  useCompanionSitEvents({ toggleSit });
  useCompanionFreezeEvents({ toggleFreeze });
  useCompanionMenuEvents({
    onTurnAround: turnAround,
    onPlayAnimation: playMenuAnimation,
    onToggleFreeze: toggleFreeze,
    onToggleMute: toggleMute,
    onDuplicate: duplicate,
    onTurnOff: turnOff,
    onUnfreeze: unfreeze,
  });
  useCompanionWalkPickerEvents({
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

  useCompanionSpeechWindow({
    dialogueText,
    getAnchorPosition,
    isReady,
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

  if (!isReady) {
    return null;
  }

  const width = registry.spriteWidth * instance.scale;
  const height = registry.spriteHeight * instance.scale;

  return (
    <div
      className={`relative overflow-visible ${
        backgroundMode === "gray" ? "bg-neutral-600/45" : "bg-transparent"
      }`}
      style={{ width, height }}
    >
      <CompanionSurfaceLockIndicator
        visible={showTitleBarLockHint && behaviorState === "dragging"}
      />
      <CompanionSprite
        frameSrc={frameSrc}
        facing={facing}
        action={displayAction}
        wallSide={wallSide}
        isDragging={behaviorState === "dragging"}
        scale={instance.scale}
        spriteWidth={registry.spriteWidth}
        spriteHeight={registry.spriteHeight}
        spriteAnchor={registry.getSpriteAnchor(displayAction)}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

export function CompanionWindow() {
  const config = useCompanionInstanceConfig();

  if (!config) {
    return null;
  }

  return (
    <CompanionWindowInner
      instance={config.instance}
      registry={config.registry}
    />
  );
}
