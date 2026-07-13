import { useEffect, useState } from "react";
import { ANIMATION_CATEGORY_META } from "../../constants/animationCategories";
import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";
import { ANIMATION_CATEGORIES } from "../../types/character";
import type { AnimationCategory } from "../../types/character";
import { AnimationPreviewPlayer } from "../preview/AnimationPreviewPlayer";

interface FinalPreviewStepProps {
  controller: ShimejiDraftController;
}

export function FinalPreviewStep({ controller }: FinalPreviewStepProps) {
  const { draft, framesUrls } = controller;
  const [active, setActive] = useState<AnimationCategory>("idle");
  const [showBubble, setShowBubble] = useState(true);
  const [lineIndex, setLineIndex] = useState(0);

  const assignedCategories = ANIMATION_CATEGORIES.filter(
    (category) => draft.assignments[category].frames.length > 0,
  );

  const frames = framesUrls(active);
  const fps = draft.assignments[active].fps;
  const line = draft.dialogueLines[lineIndex];
  const previewLine = line ?? "Hi! I’m your new Tomoji!";
  const meta = ANIMATION_CATEGORY_META[active];

  useEffect(() => {
    if (assignedCategories.length === 0) {
      return;
    }
    if (!assignedCategories.includes(active)) {
      setActive(assignedCategories[0]);
    }
  }, [active, assignedCategories]);

  useEffect(() => {
    if (draft.dialogueLines.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % draft.dialogueLines.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, [draft.dialogueLines.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {assignedCategories.map((category) => {
          const categoryMeta = ANIMATION_CATEGORY_META[category];
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActive(category)}
              className={`island-pill min-h-8 px-3 py-1 text-xs ${
                active === category
                  ? "border-island-orange/60 bg-island-custard text-island-ink"
                  : "text-island-muted hover:text-island-ink"
              }`}
            >
              {categoryMeta.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-medium text-island-muted">{meta.description}</p>

      <div className="island-card flex items-center justify-center py-10">
        <div className="relative flex flex-col items-center">
          {showBubble ? (
            <div className="mb-2 max-w-[200px] rounded-2xl border border-island-ink/25 bg-island-paper px-3 py-1.5 text-center text-xs font-medium text-island-ink">
              {previewLine}
            </div>
          ) : null}
          <AnimationPreviewPlayer
            frames={frames}
            fps={fps}
            width={draft.frameWidth * draft.scale}
            height={draft.frameHeight * draft.scale}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium text-island-muted">
        <span>Scale {draft.scale.toFixed(2)}x</span>
        <span>Speed {draft.speed.toFixed(1)} px/tick</span>
        <button
          type="button"
          onClick={() => setShowBubble((current) => !current)}
          className="island-button island-button--soft min-h-8 px-3 py-1 text-xs"
        >
          {showBubble ? "Hide" : "Show"} dialogue
        </button>
      </div>
    </div>
  );
}
