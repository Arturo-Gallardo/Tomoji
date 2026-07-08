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
    <div className="flex shrink-0 border-b border-neutral-800 bg-neutral-950 px-6 py-2.5">
      <div
        className="flex min-w-0 gap-1.5 overflow-x-auto"
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                isSelected
                  ? "bg-white text-black"
                  : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
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
