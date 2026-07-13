import { IslandIcon } from "../ui/IslandIcon";

interface CompanionSurfaceLockIndicatorProps {
  visible: boolean;
}

export function CompanionSurfaceLockIndicator({
  visible,
}: CompanionSurfaceLockIndicatorProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="island-badge island-badge--active pointer-events-none absolute right-1 top-1 z-10 !min-h-0 gap-1 !border-2 !border-[var(--color-island-ink)] !px-1.5 !py-0.5 shadow-sm"
      title="Release to attach to this window"
      aria-label="Release to attach to this window"
    >
      <IslandIcon name="check" className="h-3 w-3 shrink-0" />
      <span className="text-[9px] font-black leading-none tracking-wide">
        Snap ready
      </span>
    </div>
  );
}
