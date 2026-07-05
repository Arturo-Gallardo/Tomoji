import { useEffect, useMemo, useState } from "react";
import {
  ACTION_INTENT_ORDER,
  loadShimejiGraphEditorData,
  saveShimejiGraphEditorData,
  type ShimejiGraphEditorData,
} from "../../services/shimejiGraphEditor";
import type { ShimejiActionIntent } from "../../types/shimejiGraph";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";

interface ShimejiGraphEditorProps {
  characterId: string;
  characterName: string;
  onClose: () => void;
  onSaved: () => void;
}

const INTENT_LABELS: Record<ShimejiActionIntent, string> = {
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
  climbCeiling: "Climb ceiling",
};

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "failed";
}

export function ShimejiGraphEditor({
  characterId,
  characterName,
  onClose,
  onSaved,
}: ShimejiGraphEditorProps) {
  const [data, setData] = useState<ShimejiGraphEditorData | null>(null);
  const [defaultActions, setDefaultActions] = useState<
    Partial<Record<ShimejiActionIntent, string>>
  >({});
  const [menuActionNames, setMenuActionNames] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadShimejiGraphEditorData(characterId)
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        setData(nextData);
        setDefaultActions(nextData.manifest.shimejiGraph?.defaultActions ?? {});
        setMenuActionNames(
          nextData.editableMenuActions.map((action) => action.actionName),
        );
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(errorMessage(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const menuCandidates = useMemo(() => data?.actionNames ?? [], [data]);

  const toggleMenuAction = (actionName: string) => {
    setMenuActionNames((current) => {
      if (current.includes(actionName)) {
        return current.filter((name) => name !== actionName);
      }

      if (current.length >= 6) {
        return current;
      }

      return [...current, actionName];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveShimejiGraphEditorData(
        characterId,
        defaultActions,
        menuActionNames,
      );
      onSaved();
    } catch (caught) {
      setSaveError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Edit Shimeji graph — ${characterName}`}
            onBack={onClose}
          />
        }
      >
        <p className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </p>
      </TomojiPageLayout>
    );
  }

  if (!data?.manifest.shimejiGraph) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Edit Shimeji graph — ${characterName}`}
            onBack={onClose}
          />
        }
      >
        <p className="text-sm text-neutral-400">Loading Shimeji graph...</p>
      </TomojiPageLayout>
    );
  }

  const graph = data.manifest.shimejiGraph;

  return (
    <TomojiPageLayout
      wide
      header={
        <TomojiPageHeader
          title={`Edit Shimeji graph — ${characterName}`}
          subtitle="Edit semantic action mapping and context-menu animations"
          onBack={onClose}
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save graph"}
          </button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="text-sm font-bold text-white">Import structure</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500">Actions</dt>
              <dd className="text-neutral-100">
                {graph.importReport.actionsParsed}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Behaviors</dt>
              <dd className="text-neutral-100">
                {graph.importReport.behaviorsParsed}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Poses</dt>
              <dd className="text-neutral-100">{graph.importReport.posesParsed}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Canvas</dt>
              <dd className="text-neutral-100">
                {graph.spriteCanvas.width}×{graph.spriteCanvas.height}
              </dd>
            </div>
          </dl>

          {graph.importReport.issues.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {graph.importReport.issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="text-sm font-bold text-white">Context menu actions</h2>
          <p className="mt-2 text-xs text-neutral-500">
            Pick up to 6 imported Shimeji actions for the Animations menu.
          </p>
          <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
            {menuCandidates.map((actionName) => {
              const checked = menuActionNames.includes(actionName);
              return (
                <label
                  key={actionName}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && menuActionNames.length >= 6}
                    onChange={() => toggleMenuAction(actionName)}
                  />
                  <span>{actionName}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-white">Core action mapping</h2>
          <p className="mt-2 text-xs text-neutral-500">
            These mappings let Tomoji movement call the closest Shimeji action.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ACTION_INTENT_ORDER.map((intent) => (
              <label key={intent} className="block text-xs font-bold text-neutral-400">
                {INTENT_LABELS[intent]}
                <select
                  value={defaultActions[intent] ?? ""}
                  onChange={(event) =>
                    setDefaultActions((current) => ({
                      ...current,
                      [intent]: event.target.value || undefined,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-normal text-white"
                >
                  <option value="">Fallback to idle</option>
                  {data.actionNames.map((actionName) => (
                    <option key={actionName} value={actionName}>
                      {actionName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      </div>

      {saveError ? (
        <p className="mt-6 rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {saveError}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
