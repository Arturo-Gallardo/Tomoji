import { useCharacterAnimationRegistry } from "../../hooks/useCharacterAnimationRegistry";
import { useCompanionAnimation } from "../../hooks/useCompanionAnimation";
import { useCompanionMirrorState } from "../../hooks/useCompanionMirrorState";
import type { AnimationRegistry } from "../../services/animationRegistry";
import type { CompanionInstance } from "../../types/companionInstance";
import { MutedIcon } from "../MutedIcon";
import { FittedTomojiSprite } from "./FittedTomojiSprite";

const PREVIEW_SCALE = 3;

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

  const previewHeight = registry.spriteHeight * PREVIEW_SCALE;

  return (
    <section className="relative flex h-full min-h-0 items-center justify-center">
      {instance.muted === true ? (
        <span className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-300">
          <MutedIcon />
          Muted
        </span>
      ) : null}
      <div
        className="flex items-center justify-center"
        style={{ minHeight: previewHeight }}
      >
        <FittedTomojiSprite
          frameSrc={frameSrc}
          facing={mirrorState.facing}
          action={mirrorState.action}
          targetHeight={previewHeight}
          maxWidth={registry.spriteWidth * PREVIEW_SCALE}
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
