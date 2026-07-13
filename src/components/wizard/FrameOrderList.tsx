import { useState, type ReactNode } from "react";

interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "neutral" | "danger";
  compact?: boolean;
  children: ReactNode;
}

function IconButton({
  label,
  onClick,
  disabled = false,
  variant = "neutral",
  compact = false,
  children,
}: IconButtonProps) {
  const variantClass =
    variant === "danger"
      ? "text-red-700 hover:border-red-700/50 hover:bg-red-100 hover:text-red-800 disabled:hover:border-island-ink/20 disabled:hover:bg-transparent disabled:hover:text-island-muted"
      : "text-island-muted hover:border-island-ink/55 hover:bg-island-custard/70 hover:text-island-ink disabled:hover:border-island-ink/20 disabled:hover:bg-transparent disabled:hover:text-island-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded border border-island-ink/30 bg-island-paper transition disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? "h-4 w-4" : "h-7 w-7"
      } ${variantClass}`}
    >
      {children}
    </button>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 10l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="m10 4-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="m6 4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M6.5 7v4M9.5 7v4M4.5 4.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface FrameOrderListProps {
  frames: string[];
  urlFor: (path: string) => string;
  nameFor: (path: string) => string;
  onMove: (index: number, direction: -1 | 1) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  compact?: boolean;
}

export function FrameOrderList({
  frames,
  urlFor,
  nameFor,
  onMove,
  onReorder,
  onRemove,
  compact = false,
}: FrameOrderListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (frames.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-island-ink/30 px-3 py-4 text-center text-xs font-medium text-island-muted">
        No frames yet — click sprites on the left to add them.
      </p>
    );
  }

  return (
    <ol className={compact ? "flex gap-2 overflow-x-auto pb-1" : "flex flex-col gap-2"}>
      {frames.map((path, index) => {
        const isFirst = index === 0;
        const isLast = index === frames.length - 1;

        if (compact) {
          return (
            <li
              key={`${path}-${index}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
                setDraggedIndex(index);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(fromIndex)) {
                  onReorder(fromIndex, index);
                }
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className={`relative flex h-16 w-16 shrink-0 cursor-grab flex-col items-center justify-between rounded-md border border-island-ink/30 bg-island-paper p-1 active:cursor-grabbing ${
                draggedIndex === index ? "opacity-50" : ""
              }`}
            >
              <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded bg-island-custard text-[9px] font-extrabold text-island-ink">
                {index + 1}
              </span>
              <img
                src={urlFor(path)}
                alt=""
                className="h-8 w-8 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="flex items-center gap-1">
                <IconButton
                  compact
                  label="Move earlier"
                  onClick={() => onMove(index, -1)}
                  disabled={isFirst}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  compact
                  label="Move later"
                  onClick={() => onMove(index, 1)}
                  disabled={isLast}
                >
                  <ChevronRightIcon />
                </IconButton>
                <IconButton
                  compact
                  label="Remove frame"
                  variant="danger"
                  onClick={() => onRemove(index)}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </li>
          );
        }

        return (
          <li
            key={`${path}-${index}`}
            className="flex items-center gap-2 rounded-lg border border-island-ink/30 bg-island-paper/80 px-2 py-1.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-island-custard text-[10px] font-extrabold text-island-ink">
              {index + 1}
            </span>
            <img
              src={urlFor(path)}
              alt=""
              className="h-8 w-8 shrink-0 rounded border border-island-ink/30 bg-island-cream object-contain p-0.5"
              style={{ imageRendering: "pixelated" }}
            />
            <span
              className="min-w-0 flex-1 truncate text-[11px] font-medium text-island-muted"
              aria-label={nameFor(path)}
            >
              {nameFor(path)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Move up"
                onClick={() => onMove(index, -1)}
                disabled={isFirst}
              >
                <ChevronUpIcon />
              </IconButton>
              <IconButton
                label="Move down"
                onClick={() => onMove(index, 1)}
                disabled={isLast}
              >
                <ChevronDownIcon />
              </IconButton>
              <IconButton
                label="Remove frame"
                variant="danger"
                onClick={() => onRemove(index)}
              >
                <TrashIcon />
              </IconButton>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
