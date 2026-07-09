interface DialogueLinesEditorProps {
  lineDraft: string;
  lines: readonly string[];
  onAddLine: () => void;
  onLineDraftChange: (lineDraft: string) => void;
  onRemoveLine: (index: number) => void;
}

export function DialogueLinesEditor({
  lineDraft,
  lines,
  onAddLine,
  onLineDraftChange,
  onRemoveLine,
}: DialogueLinesEditorProps) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          Dialogue lines
        </span>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={lineDraft}
            onChange={(event) => onLineDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAddLine();
              }
            }}
            placeholder="Add a line..."
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white"
          />
          <button
            type="button"
            onClick={onAddLine}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black"
          >
            Add
          </button>
        </div>

        {lines.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {lines.map((line, index) => (
              <li
                key={`${line}-${index}`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
              >
                <span className="truncate">{line}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLine(index)}
                  className="px-2 text-red-300 hover:text-red-200"
                  aria-label="Remove line"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-500">
            No dialogue lines yet.
          </p>
        )}
      </div>
    </div>
  );
}
