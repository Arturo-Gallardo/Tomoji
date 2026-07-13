import { useEffect, useState } from "react";
import {
  ANIMATION_CATEGORY_GROUPS,
  ANIMATION_CATEGORY_META,
  type AnimationCategoryGroupId,
} from "../../constants/animationCategories";
import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";
import type { AnimationCategory } from "../../types/character";
import { AnimationAssignmentPanel } from "./AnimationAssignmentPanel";
import { AnimationCategoryGroupSection } from "./AnimationCategoryGroupSection";

interface AssignAnimationsStepProps {
  controller: ShimejiDraftController;
}

const DEFAULT_OPEN_GROUPS = new Set<AnimationCategoryGroupId>(["ground"]);

function groupForCategory(
  category: AnimationCategory,
): AnimationCategoryGroupId {
  return ANIMATION_CATEGORY_META[category].group;
}

export function AssignAnimationsStep({ controller }: AssignAnimationsStepProps) {
  const [active, setActive] = useState<AnimationCategory>("idle");
  const [openGroups, setOpenGroups] =
    useState<Set<AnimationCategoryGroupId>>(DEFAULT_OPEN_GROUPS);
  const { draft } = controller;

  // keep the group for the active slot open when selection changes
  useEffect(() => {
    const groupId = groupForCategory(active);
    setOpenGroups((current) => {
      if (current.has(groupId)) {
        return current;
      }
      return new Set([...current, groupId]);
    });
  }, [active]);

  const toggleGroup = (groupId: AnimationCategoryGroupId) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="flex gap-8">
      <aside className="w-52 shrink-0">
        <p className="mb-4 text-xs leading-relaxed text-island-muted">
          <span className="font-extrabold text-island-ink">Idle</span> and{" "}
          <span className="font-extrabold text-island-ink">Walk</span> need at least
          one frame. Expand a group to assign optional animations.
        </p>

        <nav className="space-y-2" aria-label="Animation categories">
          {ANIMATION_CATEGORY_GROUPS.map((group) => (
            <AnimationCategoryGroupSection
              key={group.id}
              group={group}
              assignments={draft.assignments}
              active={active}
              isOpen={openGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              onSelect={setActive}
            />
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <AnimationAssignmentPanel controller={controller} category={active} />
      </div>
    </div>
  );
}
