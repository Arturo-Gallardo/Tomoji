import { useCharacterAnimationRegistry } from "../../hooks/useCharacterAnimationRegistry";
import { useCompanionAnimation } from "../../hooks/useCompanionAnimation";
import { useCompanionMirrorState } from "../../hooks/useCompanionMirrorState";
import type { AnimationRegistry } from "../../services/animationRegistry";
import type { CompanionInstance } from "../../types/companionInstance";
import { MutedIcon } from "../MutedIcon";
import { FittedTomojiSprite } from "./FittedTomojiSprite";

const PREVIEW_SCALE = 3;
const MIN_PREVIEW_HEIGHT = 180;
const MAX_PREVIEW_HEIGHT = 340;

interface CompanionPreviewProps {
  instance: CompanionInstance;
}

interface CompanionPreviewInnerProps {
  instance: CompanionInstance;
  registry: AnimationRegistry;
}

function CompanionPreviewInner({
  instance,
  registry,
}: CompanionPreviewInnerProps) {
  const mirrorState = useCompanionMirrorState(instance.id);

  const { frameSrc } = useCompanionAnimation({
    registry,
    action: mirrorState.action,
    facing: mirrorState.facing,
    grabbedLeanTier: mirrorState.grabbedLeanTier,
  });

  const previewHeight = Math.max(
    MIN_PREVIEW_HEIGHT,
    Math.min(registry.spriteHeight * PREVIEW_SCALE, MAX_PREVIEW_HEIGHT),
  );
  const previewWidth = Math.min(
    registry.spriteWidth * PREVIEW_SCALE,
    MAX_PREVIEW_HEIGHT,
  );
  const statusLabel = mirrorState.isFrozen
    ? "Frozen"
    : mirrorState.behaviorState === "sitting"
      ? "Sitting"
      : mirrorState.action;

  return (
    <section className="relative flex min-h-[28rem] items-center justify-center overflow-hidden rounded-3xl border border-neutral-800/80 bg-[radial-gradient(circle_at_center,rgba(64,64,64,0.28),rgba(10,10,10,0)_54%)] shadow-2xl shadow-black/25 lg:min-h-[34rem]">
      {instance.muted === true ? (
        <span className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/90 px-3 py-1.5 text-xs font-bold text-neutral-300">
          <MutedIcon />
          Muted
        </span>
      ) : null}
      <div className="absolute right-5 top-5 rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-1.5 text-xs font-bold capitalize text-neutral-400">
        {statusLabel}
      </div>
      <div
        className="absolute inset-x-10 bottom-24 h-px bg-gradient-to-r from-transparent via-neutral-700/80 to-transparent"
        aria-hidden
      />
      <div
        className="relative z-10 flex items-center justify-center"
        style={{ minHeight: previewHeight }}
      >
        <FittedTomojiSprite
          frameSrc={frameSrc}
          facing={mirrorState.facing}
          action={mirrorState.action}
          targetHeight={previewHeight}
          maxWidth={previewWidth}
        />
      </div>
    </section>
  );
}

export function CompanionPreview({ instance }: CompanionPreviewProps) {
  const registry = useCharacterAnimationRegistry(instance.characterId);

  if (registry === null) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center text-sm text-neutral-500">
        Loading preview…
      </section>
    );
  }

  return <CompanionPreviewInner instance={instance} registry={registry} />;
}
