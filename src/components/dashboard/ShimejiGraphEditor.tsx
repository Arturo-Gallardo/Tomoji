import { useCallback, useEffect, useState } from "react";
import {
  ACTION_INTENT_ORDER,
  loadShimejiGraphEditorData,
  saveShimejiGraphEditorData,
  type ShimejiGraphEditorData,
} from "../../services/shimejiGraphEditor";
import type { ShimejiActionIntent, ShimejiGraphPose } from "../../types/shimejiGraph";
import {
  SHIMEJI_ACTION_INTENT_LABELS,
  ShimejiGraphActionBrowser,
  ShimejiGraphActionPreview,
  ShimejiGraphActionThumb,
} from "../shimejiGraph/ShimejiGraphActionPreview";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";

interface ShimejiGraphEditorProps {
  characterId: string;
  characterName: string;
  onClose: () => void;
  onSaved: () => void;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "failed";
}

function firstPreviewableActionName(data: ShimejiGraphEditorData): string | null {
  return (
    data.manifest.shimejiGraph?.defaultActions.idle ??
    data.manifest.shimejiGraph?.defaultActions.walk ??
    data.actionNames[0] ??
    null
  );
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
  const [selectedActionName, setSelectedActionName] = useState<string | null>(
    null,
  );
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
        setSelectedActionName(firstPreviewableActionName(nextData));
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

  const hasUnsavedChanges =
    data?.manifest.shimejiGraph !== undefined &&
    (JSON.stringify(defaultActions) !==
      JSON.stringify(data.manifest.shimejiGraph.defaultActions) ||
      JSON.stringify(menuActionNames) !==
        JSON.stringify(
          data.editableMenuActions.map((action) => action.actionName),
        ));

  const handleClose = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved graph mapping changes?")
    ) {
      return;
    }

    onClose();
  };

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

  const resolvePoseUrl = useCallback(
    (pose: ShimejiGraphPose) => {
      if (!pose.src || !data) {
        return null;
      }

      return data.poseUrlsBySrc[pose.src] ?? null;
    },
    [data],
  );

  const assignSelectedToIntent = (intent: ShimejiActionIntent) => {
    if (!selectedActionName) {
      return;
    }

    setDefaultActions((current) => ({
      ...current,
      [intent]: selectedActionName,
    }));
  };

  const clearIntent = (intent: ShimejiActionIntent) => {
    setDefaultActions((current) => {
      const next = { ...current };
      delete next[intent];
      return next;
    });
  };

  const toggleSelectedMenuAction = () => {
    if (!selectedActionName) {
      return;
    }

    toggleMenuAction(selectedActionName);
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
            onBack={handleClose}
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
            onBack={handleClose}
          />
        }
      >
        <p className="text-sm text-neutral-400">Loading Shimeji graph...</p>
      </TomojiPageLayout>
    );
  }

  const graph = data.manifest.shimejiGraph;
  const selectedIsMenuAction =
    selectedActionName !== null && menuActionNames.includes(selectedActionName);

  return (
    <TomojiPageLayout
      wide
      header={
        <TomojiPageHeader
          title={`Edit Shimeji graph — ${characterName}`}
          subtitle="Edit semantic action mapping and context-menu animations"
          onBack={handleClose}
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleClose}
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
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
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

        <ShimejiGraphActionPreview
          graph={graph}
          actionName={selectedActionName}
          resolvePoseUrl={resolvePoseUrl}
        />

        <div className="min-w-0 xl:row-span-2">
          <ShimejiGraphActionBrowser
            graph={graph}
            selectedActionName={selectedActionName}
            onSelect={setSelectedActionName}
            resolvePoseUrl={resolvePoseUrl}
          />
        </div>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Core action mapping</h2>
              <p className="mt-2 text-xs text-neutral-500">
                Click an action in the browser, preview it, then assign it to a
                Tomoji behavior.
              </p>
            </div>
            <p className="max-w-xs text-xs text-neutral-500">
              Graph imports preserve original frame order and timing. Individual
              frames are read-only.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ACTION_INTENT_ORDER.map((intent) => {
              const mappedActionName = defaultActions[intent];

              return (
                <div
                  key={intent}
                  className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-950/35 p-3"
                >
                  <div className="flex items-center gap-3">
                    <ShimejiGraphActionThumb
                      graph={graph}
                      actionName={mappedActionName}
                      resolvePoseUrl={resolvePoseUrl}
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-neutral-400">
                        {SHIMEJI_ACTION_INTENT_LABELS[intent]}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (mappedActionName) {
                            setSelectedActionName(mappedActionName);
                          }
                        }}
                        disabled={!mappedActionName}
                        className="mt-1 block max-w-full truncate text-left text-sm font-bold text-white disabled:text-neutral-600"
                        title={mappedActionName ?? "Fallback to idle"}
                      >
                        {mappedActionName ?? "Fallback to idle"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!selectedActionName}
                      onClick={() => assignSelectedToIntent(intent)}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-bold text-neutral-200 hover:border-white disabled:opacity-40"
                    >
                      Use previewed action
                    </button>
                    <button
                      type="button"
                      disabled={!mappedActionName}
                      onClick={() => clearIntent(intent)}
                      className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-500 hover:border-red-500/50 hover:text-red-300 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 xl:col-start-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">
                Context menu actions
              </h2>
              <p className="mt-2 text-xs text-neutral-500">
                Pick up to 6 previewed actions for the pet&apos;s Animations
                menu.
              </p>
            </div>
            <button
              type="button"
              disabled={
                selectedActionName === null ||
                (!selectedIsMenuAction && menuActionNames.length >= 6)
              }
              onClick={toggleSelectedMenuAction}
              className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              {selectedIsMenuAction ? "Remove previewed" : "Add previewed"}
            </button>
          </div>

          {menuActionNames.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {menuActionNames.map((actionName, index) => (
                <div
                  key={actionName}
                  className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/35 p-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-[10px] font-bold text-neutral-300">
                    {index + 1}
                  </span>
                  <ShimejiGraphActionThumb
                    graph={graph}
                    actionName={actionName}
                    resolvePoseUrl={resolvePoseUrl}
                    className="h-10 w-10 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedActionName(actionName)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-bold text-neutral-200 hover:text-white"
                    title={actionName}
                  >
                    {actionName}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMenuAction(actionName)}
                    className="rounded-md border border-neutral-800 px-2 py-1 text-[10px] font-bold text-neutral-500 hover:border-red-500/50 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-500">
              No menu actions selected yet.
            </p>
          )}
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
