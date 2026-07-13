import type { CSSProperties } from "react";
import { IslandIcon } from "../ui/IslandIcon";

interface AddTomojiCardProps {
  onAdd: () => void;
  style?: CSSProperties;
}

export function AddTomojiCard({ onAdd, style }: AddTomojiCardProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      style={style}
      className="island-grid-enter relative flex aspect-square w-full max-w-[12rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-island-ink/35 bg-island-paper transition duration-200 hover:-translate-y-0.5 hover:border-island-ink/60 hover:bg-island-orange/35"
      aria-label="Add Tomoji"
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full border-2 border-island-ink/50 bg-island-orange" aria-hidden>
        <IslandIcon name="plus" className="h-7 w-7" />
      </span>
      <span className="text-sm font-extrabold text-island-ink">Add Tomoji</span>
      <span className="mt-1 text-xs font-medium text-island-muted">Create or import</span>
    </button>
  );
}
