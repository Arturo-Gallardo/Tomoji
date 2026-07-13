import { isBuiltinCharacterId } from "../../services/characterLibrary";
import type { CompanionInstance } from "../../types/companionInstance";
import { MutedIcon } from "../MutedIcon";

interface DashboardCompanionSwitcherProps {
  instances: CompanionInstance[];
  selectedInstanceId: string | null;
  onSelect: (id: string) => void;
}

export function DashboardCompanionSwitcher({
  instances,
  selectedInstanceId,
  onSelect,
}: DashboardCompanionSwitcherProps) {
  if (instances.length <= 1) {
    return null;
  }

  return (
    <div className="mb-5 flex shrink-0 items-center gap-3">
      <span className="hidden text-xs font-extrabold uppercase tracking-[0.12em] text-island-muted sm:block">
        Choose Tomoji
      </span>
      <div
        className="island-segmented island-segmented--scroll min-w-0"
        role="tablist"
        aria-label="Companion selection"
      >
        {instances.map((instance) => {
          const isSelected = instance.id === selectedInstanceId;

          return (
            <button
              key={instance.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelect(instance.id)}
              className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border-2 px-3 py-1 text-sm font-extrabold transition ${
                isSelected
                  ? "border-island-ink/45 bg-island-orange text-island-ink"
                  : "border-transparent bg-island-paper/80 text-island-muted hover:bg-island-cream hover:text-island-ink"
              }`}
            >
              {companionLabel(instance)}
              {instance.muted === true ? (
                <span aria-label="Muted" title="Muted">
                  <MutedIcon className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function companionLabel(instance: CompanionInstance): string {
  const baseLabel = isBuiltinCharacterId(instance.characterId)
    ? instance.name
    : instance.characterId;

  return instance.isTemporaryClone ? `${baseLabel} (clone)` : baseLabel;
}
