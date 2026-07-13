import { useId } from "react";
import { IslandIcon } from "../../ui/IslandIcon";

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
  const inputId = useId();

  return (
    <section className="island-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-rose/45">
            <IslandIcon name="dialogue" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-island-ink">
              Dialogue lines
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-island-muted">
              Give this Tomoji a few things to say during island life.
            </p>
          </div>
        </div>
        <span className="island-badge shrink-0">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <div className="island-form-section mt-5">
        <label
          htmlFor={inputId}
          className="text-sm font-extrabold text-island-ink"
        >
          Add something to say
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            type="text"
            value={lineDraft}
            onChange={(event) => onLineDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAddLine();
              }
            }}
            placeholder="Add a line..."
            className="island-input min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={onAddLine}
            className="island-button island-button--primary shrink-0"
          >
            <IslandIcon name="plus" className="h-4 w-4" />
            Add line
          </button>
        </div>
      </div>

      {lines.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Saved dialogue lines">
          {lines.map((line, index) => (
            <li
              key={`${line}-${index}`}
              className="island-surface flex items-start justify-between gap-3 px-3 py-3"
            >
              <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-relaxed text-island-ink">
                “{line}”
              </span>
              <button
                type="button"
                onClick={() => onRemoveLine(index)}
                className="island-button island-button--danger min-h-9 shrink-0 px-3 py-1.5 text-xs"
                aria-label={`Remove dialogue line: ${line}`}
              >
                <IslandIcon name="trash" className="h-4 w-4" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="island-notice mt-4 flex items-center gap-3 border-dashed px-4 py-4 text-island-muted">
          <IslandIcon name="dialogue" className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold text-island-ink">
              No dialogue lines yet
            </p>
            <p className="mt-0.5 text-xs font-medium">
              Add the first line to enable manual dialogue on the dashboard.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
