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
    <section
      className="island-stage flex min-h-[28rem] items-center justify-center lg:min-h-[32rem]"
      aria-label={`${instance.name} live preview`}
    >
      <div className="absolute left-5 top-5 z-20">
        <p className="max-w-[12rem] truncate text-lg font-extrabold text-island-ink">
          {instance.name}
        </p>
        <p className="mt-0.5 text-xs font-bold text-island-muted">Live preview</p>
      </div>
      {instance.muted === true ? (
        <span className="island-badge absolute bottom-5 left-5 z-20 bg-island-rose/80">
          <MutedIcon />
          Muted
        </span>
      ) : null}
      <div className="island-badge absolute right-5 top-5 z-20 bg-island-paper capitalize">
        <span className="h-2 w-2 rounded-full border border-island-ink/50 bg-island-orange" aria-hidden />
        {statusLabel}
      </div>
      <div
        className="absolute bottom-[15%] left-1/2 h-8 w-[60%] -translate-x-1/2 rounded-[50%] border-b-2 border-island-ink/20 bg-island-ink/10 blur-[0.2px]"
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
      <section className="island-stage flex min-h-[28rem] items-center justify-center" role="status">
        <div className="text-center text-sm font-bold text-island-muted">
          <span className="mx-auto mb-3 block h-16 w-12 animate-pulse rounded-2xl bg-island-paper/70" aria-hidden />
          Waking up preview…
        </div>
      </section>
    );
  }

  return <CompanionPreviewInner instance={instance} registry={registry} />;
}
