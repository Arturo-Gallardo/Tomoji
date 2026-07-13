import { isRequiredAnimationCategory } from "../../types/character";
import type { AnimationCategory } from "../../types/character";

interface RequiredAnimationBadgeProps {
  category: AnimationCategory;
  compact?: boolean;
}

// only shown on required slots — optional ones stay unlabeled
export function RequiredAnimationBadge({
  category,
  compact = false,
}: RequiredAnimationBadgeProps) {
  if (!isRequiredAnimationCategory(category)) {
    return null;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded bg-island-orange/35 px-1.5 py-0.5 font-bold uppercase tracking-wide text-island-ink ${
        compact ? "text-[9px]" : "text-[10px]"
      }`}
    >
      Required
    </span>
  );
}
