import { useMemo } from "react";
import { ANIMATION_CATEGORY_META } from "../../constants/animationCategories";
import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";
import { isRequiredAnimationCategory } from "../../types/character";
import type { AnimationCategory } from "../../types/character";
import { AnimationPreviewPlayer } from "../preview/AnimationPreviewPlayer";
import { FrameOrderList } from "./FrameOrderList";
import { RequiredAnimationBadge } from "./AnimationCategoryBadge";

interface AnimationAssignmentPanelProps {
  controller: ShimejiDraftController;
  category: AnimationCategory;
}

const PREVIEW_SIZE = 80;

function countFrameUsage(frames: string[], path: string): number {
  return frames.filter((frame) => frame === path).length;
}

export function AnimationAssignmentPanel({
  controller,
  category,
}: AnimationAssignmentPanelProps) {
  const {
    draft,
    urlFor,
    framesUrls,
    addFrame,
    removeFrame,
    removeLastFrameByPath,
    moveFrame,
    reorderFrame,
    setFps,
  } = controller;
  const assignment = draft.assignments[category];
  const previewFrames = framesUrls(category);
  const meta = ANIMATION_CATEGORY_META[category];
  const required = isRequiredAnimationCategory(category);
  const missingRequired = required && assignment.frames.length === 0;
  const canAdjustSpeed = assignment.frames.length > 1;

  const nameByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const source of draft.sources) {
      map.set(source.path, source.name);
    }
    return map;
  }, [draft.sources]);

  const nameFor = (path: string) => nameByPath.get(path) ?? path;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border px-4 py-3 ${
          missingRequired
            ? "border-island-orange/60 bg-island-custard/70"
            : "border-island-ink/30 bg-island-paper/80"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-island-ink">{meta.label}</p>
          <RequiredAnimationBadge category={category} />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-island-muted">
          {meta.description}
        </p>
        {missingRequired ? (
          <p className="mt-2 text-xs font-bold text-island-ink">
            Add at least one frame — this slot is required.
          </p>
        ) : null}
      </div>

      <div className="island-card inline-flex max-w-full flex-wrap items-center gap-3 p-3">
        <div className="island-surface flex items-center justify-center bg-island-cream p-2">
          <AnimationPreviewPlayer
            frames={previewFrames}
            fps={assignment.fps}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
          />
        </div>

        {canAdjustSpeed ? (
          <label className="flex w-44 flex-col gap-1.5 text-xs font-extrabold text-island-ink">
            <span>
              Speed: <output>{assignment.fps} fps</output>
            </span>
            <input
              type="range"
              min={1}
              max={24}
              value={assignment.fps}
              onChange={(event) => setFps(category, Number(event.target.value))}
              className="island-slider w-full"
            />
          </label>
        ) : null}

        <div className="w-80 max-w-full">
          <p className="mb-1 text-xs font-extrabold text-island-ink">
            Playback order ({assignment.frames.length})
          </p>
          <FrameOrderList
            compact
            frames={assignment.frames}
            urlFor={urlFor}
            nameFor={nameFor}
            onMove={(index, direction) => moveFrame(category, index, direction)}
            onReorder={(fromIndex, toIndex) =>
              reorderFrame(category, fromIndex, toIndex)
            }
            onRemove={(index) => removeFrame(category, index)}
          />
        </div>
      </div>

      <div>
        <div className="mb-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-island-ink">
            Source frames
          </p>
          <p className="text-xs font-medium text-island-muted">
            Left-click to add · right-click to remove last copy · duplicates
            allowed
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 rounded-xl border border-island-ink/30 bg-island-paper/70 p-3">
          {draft.sources.map((source) => {
            const usageCount = countFrameUsage(assignment.frames, source.path);

            return (
              <button
                key={source.path}
                type="button"
                onClick={() => addFrame(category, source.path)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  removeLastFrameByPath(category, source.path);
                }}
                aria-label={
                  usageCount > 0
                    ? `${source.name} — left-click add, right-click remove last copy (${usageCount} assigned)`
                    : `${source.name} — left-click to add`
                }
                className="relative flex aspect-square items-center justify-center rounded-md border border-island-ink/30 p-1 transition hover:border-island-ink/55 hover:bg-island-custard/70"
              >
                <img
                  src={source.url}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                {usageCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-island-orange px-1 text-[10px] font-extrabold text-island-ink">
                    {usageCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
