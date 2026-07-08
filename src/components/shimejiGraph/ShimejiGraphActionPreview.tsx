import { useMemo, useState } from "react";
import { AnimationPreviewPlayer } from "../preview/AnimationPreviewPlayer";
import type {
  ShimejiActionIntent,
  ShimejiAnimationGraph,
  ShimejiGraphAction,
  ShimejiGraphPose,
} from "../../types/shimejiGraph";

export const SHIMEJI_ACTION_INTENT_LABELS: Record<ShimejiActionIntent, string> = {
  idle: "Idle",
  walk: "Walk",
  floorCrawl: "Floor crawl",
  sit: "Sit",
  sitAlt: "Sit alt 1",
  sitAlt2: "Lie down",
  sitOnBar: "Sit on bar",
  dangleOnBar: "Dangle on bar",
  fall: "Fall",
  bounce: "Bounce",
  dragged: "Dragged",
  dragResist: "Drag resist",
  grabWall: "Grab wall",
  climbWall: "Climb wall",
  grabCeiling: "Grab ceiling",
  climbCeiling: "Ceiling crawl",
};

interface ActionBrowserRow {
  action: ShimejiGraphAction;
  badges: string[];
}

interface ShimejiGraphActionBrowserProps {
  graph: ShimejiAnimationGraph;
  selectedActionName: string | null;
  onSelect: (actionName: string) => void;
  resolvePoseUrl: (pose: ShimejiGraphPose) => string | null;
}

interface ShimejiGraphActionPreviewProps {
  graph: ShimejiAnimationGraph;
  actionName: string | null;
  resolvePoseUrl: (pose: ShimejiGraphPose) => string | null;
}

interface ShimejiGraphActionThumbProps {
  graph: ShimejiAnimationGraph;
  actionName: string | null | undefined;
  resolvePoseUrl: (pose: ShimejiGraphPose) => string | null;
  className?: string;
}

const SHIMEJI_TICK_MS = 25;
const PREVIEW_SIZE = 132;

export function flattenShimejiGraphAction(
  actionName: string,
  actions: Readonly<Record<string, ShimejiGraphAction>>,
  seen: ReadonlySet<string> = new Set(),
): ShimejiGraphPose[] {
  const action = actions[actionName];
  if (!action || seen.has(actionName)) {
    return [];
  }

  if (action.poses.length > 0) {
    return action.poses;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(actionName);
  return action.references.flatMap((reference) =>
    flattenShimejiGraphAction(reference.name, actions, nextSeen),
  );
}

function actionDurationMs(poses: readonly ShimejiGraphPose[]): number {
  return poses.reduce(
    (total, pose) => total + pose.durationTicks * SHIMEJI_TICK_MS,
    0,
  );
}

function fpsForPoses(poses: readonly ShimejiGraphPose[]): number {
  if (poses.length === 0) {
    return 8;
  }

  const averageMs = actionDurationMs(poses) / poses.length;
  return Math.max(1, Math.min(24, Math.round(1000 / averageMs)));
}

function frameUrls(
  poses: readonly ShimejiGraphPose[],
  resolvePoseUrl: (pose: ShimejiGraphPose) => string | null,
): string[] {
  return poses
    .map((pose) => resolvePoseUrl(pose))
    .filter((url): url is string => url !== null && url.length > 0);
}

function firstFrameUrl(
  graph: ShimejiAnimationGraph,
  actionName: string | null | undefined,
  resolvePoseUrl: (pose: ShimejiGraphPose) => string | null,
): string | null {
  if (!actionName) {
    return null;
  }

  const [pose] = flattenShimejiGraphAction(actionName, graph.actions);
  return pose ? resolvePoseUrl(pose) : null;
}

function actionBadges(
  graph: ShimejiAnimationGraph,
  actionName: string,
): string[] {
  const badges = Object.entries(graph.defaultActions)
    .filter(([, mappedActionName]) => mappedActionName === actionName)
    .map(([intent]) => SHIMEJI_ACTION_INTENT_LABELS[intent as ShimejiActionIntent]);

  if (graph.menuActions.some((menuAction) => menuAction.actionName === actionName)) {
    badges.push("Menu");
  }

  return badges;
}

function buildRows(graph: ShimejiAnimationGraph): ActionBrowserRow[] {
  const rows = Object.values(graph.actions)
    .filter((action) => action.poses.length > 0 || action.references.length > 0)
    .map((action) => ({
      action,
      badges: actionBadges(graph, action.name),
    }));

  return rows.sort((a, b) => {
    const aPinned = a.badges.length > 0 ? 0 : 1;
    const bPinned = b.badges.length > 0 ? 0 : 1;
    if (aPinned !== bPinned) {
      return aPinned - bPinned;
    }

    return a.action.name.localeCompare(b.action.name, undefined, {
      numeric: true,
    });
  });
}

function matchesQuery(row: ActionBrowserRow, query: string): boolean {
  if (query.trim() === "") {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  return (
    row.action.name.toLowerCase().includes(normalized) ||
    row.action.type?.toLowerCase().includes(normalized) ||
    row.action.borderType?.toLowerCase().includes(normalized) ||
    row.badges.some((badge) => badge.toLowerCase().includes(normalized))
  );
}

export function ShimejiGraphActionThumb({
  graph,
  actionName,
  resolvePoseUrl,
  className = "",
}: ShimejiGraphActionThumbProps) {
  const src = firstFrameUrl(graph, actionName, resolvePoseUrl);

  return (
    <div
      className={`min-w-0 overflow-hidden flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-contain p-1"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span className="text-[10px] text-neutral-600">none</span>
      )}
    </div>
  );
}

export function ShimejiGraphActionBrowser({
  graph,
  selectedActionName,
  onSelect,
  resolvePoseUrl,
}: ShimejiGraphActionBrowserProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildRows(graph), [graph]);
  const visibleRows = rows.filter((row) => matchesQuery(row, query));

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Action browser</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Preview imported actions before mapping them. Frames are read-only
            for graph imports.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-bold text-neutral-400">
          {rows.length}
        </span>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search actions, intent, type..."
        className="mt-4 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white"
      />

      <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
        {visibleRows.map((row) => {
          const poses = flattenShimejiGraphAction(row.action.name, graph.actions);
          const isSelected = selectedActionName === row.action.name;

          return (
            <button
              key={row.action.name}
              type="button"
              onClick={() => onSelect(row.action.name)}
              className={`min-w-0 flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                isSelected
                  ? "border-white bg-white text-black"
                  : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900"
              }`}
            >
              <ShimejiGraphActionThumb
                graph={graph}
                actionName={row.action.name}
                resolvePoseUrl={resolvePoseUrl}
                className="h-14 w-14 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {row.action.name}
                </span>
                <span
                  className={`mt-1 block text-xs ${
                    isSelected ? "text-black/60" : "text-neutral-500"
                  }`}
                >
                  {poses.length} frame{poses.length === 1 ? "" : "s"}
                  {row.action.references.length > 0
                    ? ` · ${row.action.references.length} ref`
                    : ""}
                </span>
                {row.badges.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {row.badges.slice(0, 3).map((badge) => (
                      <span
                        key={badge}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-black/10 text-black"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {badge}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ShimejiGraphActionPreview({
  graph,
  actionName,
  resolvePoseUrl,
}: ShimejiGraphActionPreviewProps) {
  const action = actionName ? graph.actions[actionName] : undefined;
  const poses = actionName
    ? flattenShimejiGraphAction(actionName, graph.actions)
    : [];
  const frames = frameUrls(poses, resolvePoseUrl);
  const fps = fpsForPoses(poses);
  const durationMs = actionDurationMs(poses);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-white">
            {action?.name ?? "Select an action"}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {action
              ? `${poses.length} frame${poses.length === 1 ? "" : "s"} · ${durationMs}ms loop · approx ${fps} fps`
              : "Choose an action to inspect playback."}
          </p>
        </div>
        {action?.type || action?.borderType ? (
          <div className="flex flex-wrap justify-end gap-1">
            {action.type ? (
              <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-bold text-neutral-300">
                {action.type}
              </span>
            ) : null}
            {action.borderType ? (
              <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-bold text-neutral-300">
                {action.borderType}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex min-w-0 flex-wrap gap-5">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
          <AnimationPreviewPlayer
            frames={frames}
            fps={fps}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-xs text-neutral-400 [overflow-wrap:anywhere]">
          {action?.condition ? (
            <p>
              <span className="text-neutral-500">Condition:</span>{" "}
              {action.condition}
            </p>
          ) : null}
          {action && action.references.length > 0 ? (
            <p>
              <span className="text-neutral-500">References:</span>{" "}
              {action.references.map((reference) => reference.name).join(", ")}
            </p>
          ) : null}
          {action ? (
            <p>
              This preview follows the same flattened action references Tomoji
              uses at runtime. Individual imported frames are not editable here.
            </p>
          ) : null}
        </div>
      </div>

      {poses.length > 0 ? (
        <div className="mt-5 min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            Playback order
          </p>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {poses.slice(0, 48).map((pose, index) => {
              const src = resolvePoseUrl(pose);

              return (
                <div
                  key={`${pose.src}-${pose.source ?? ""}-${index}`}
                  className="w-16 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-1"
                  title={`${pose.durationTicks} ticks`}
                >
                  <div className="flex h-12 items-center justify-center">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-600">missing</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-center text-[10px] text-neutral-500">
                    {index + 1} · {pose.durationTicks}t
                  </p>
                </div>
              );
            })}
          </div>
          {poses.length > 48 ? (
            <p className="mt-2 text-xs text-neutral-600">
              Showing first 48 frames.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
