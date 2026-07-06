interface AddTomojiCardProps {
  onAdd: () => void;
}

export function AddTomojiCard({ onAdd }: AddTomojiCardProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="relative flex aspect-square w-full max-w-[11rem] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-600 bg-neutral-950 transition hover:border-white hover:bg-neutral-900"
      aria-label="Add Tomoji"
    >
      <span className="relative mb-3 h-14 w-14" aria-hidden>
        <span className="absolute left-1/2 top-0 h-14 w-[1.5px] -translate-x-1/2 bg-white" />
        <span className="absolute left-0 top-1/2 h-[1.5px] w-14 -translate-y-1/2 bg-white" />
      </span>
      <span className="text-sm font-bold text-white">Add Tomoji</span>
      <span className="mt-1 text-xs text-neutral-500">Import pack</span>
    </button>
  );
}
