import {
  ANIMATION_CATEGORY_META,
  type AnimationCategoryGroup,
} from "../../constants/animationCategories";
import type { CategoryAssignments } from "../../types/shimejiDraft";
import {
  isRequiredAnimationCategory,
  type AnimationCategory,
} from "../../types/character";
import { RequiredAnimationBadge } from "./AnimationCategoryBadge";

interface AnimationCategoryGroupSectionProps {
  group: AnimationCategoryGroup;
  assignments: CategoryAssignments;
  active: AnimationCategory;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (category: AnimationCategory) => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-island-muted transition-transform ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      aria-hidden
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function groupHasMissingRequired(
  group: AnimationCategoryGroup,
  assignments: CategoryAssignments,
): boolean {
  for (const category of group.categories) {
    if (
      isRequiredAnimationCategory(category) &&
      assignments[category].frames.length === 0
    ) {
      return true;
    }
  }

  return false;
}

export function AnimationCategoryGroupSection({
  group,
  assignments,
  active,
  isOpen,
  onToggle,
  onSelect,
}: AnimationCategoryGroupSectionProps) {
  const missingRequired = groupHasMissingRequired(group, assignments);

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-island-custard/70 ${
          missingRequired && !isOpen
            ? "border border-island-orange/50 bg-island-custard/50"
            : ""
        }`}
      >
        <ChevronIcon open={isOpen} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-wider text-island-muted">
          {group.label}
        </span>
        {missingRequired ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-island-orange"
            aria-hidden
          />
        ) : null}
      </button>

      {isOpen ? (
        <ul className="mt-1 flex flex-col gap-1 pl-1">
          {group.categories.map((category) => {
            const count = assignments[category].frames.length;
            const meta = ANIMATION_CATEGORY_META[category];
            const required = isRequiredAnimationCategory(category);
            const missingRequired = required && count === 0;
            const isActive = active === category;

            return (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => onSelect(category)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition ${
                    isActive
                      ? "border border-island-orange/60 bg-island-custard/80 text-island-ink shadow-[0_1px_0_rgba(24,52,79,0.1)]"
                      : missingRequired
                        ? "border border-island-orange/60 bg-island-custard/70 text-island-ink hover:border-island-ink/55"
                        : "text-island-muted hover:bg-island-custard/70 hover:text-island-ink"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                  {required ? (
                    <RequiredAnimationBadge category={category} compact />
                  ) : null}
                  {count > 0 ? (
                    <span className="text-island-muted">{count}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
