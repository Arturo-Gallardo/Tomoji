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
            title={`Remap Shimeji actions — ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <p className="island-notice island-notice--error px-4 py-3 text-sm font-medium">
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
            title={`Remap Shimeji actions — ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <p className="text-sm font-medium text-island-muted">Loading Shimeji graph...</p>
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
          title={`Remap Shimeji actions — ${characterName}`}
          subtitle="Remap preserved Shimeji actions and context-menu animations"
          onBack={handleClose}
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="island-button island-button--soft text-sm"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="island-button island-button--action text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save mappings"}
          </button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="island-card min-w-0 overflow-hidden p-5">
          <h2 className="text-sm font-extrabold text-island-ink">Import structure</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-island-muted">Actions</dt>
              <dd className="font-extrabold text-island-ink">
                {graph.importReport.actionsParsed}
              </dd>
            </div>
            <div>
              <dt className="text-island-muted">Behaviors</dt>
              <dd className="font-extrabold text-island-ink">
                {graph.importReport.behaviorsParsed}
              </dd>
            </div>
            <div>
              <dt className="text-island-muted">Poses</dt>
              <dd className="font-extrabold text-island-ink">{graph.importReport.posesParsed}</dd>
            </div>
            <div>
              <dt className="text-island-muted">Canvas</dt>
              <dd className="font-extrabold text-island-ink">
                {graph.spriteCanvas.width}×{graph.spriteCanvas.height}
              </dd>
            </div>
          </dl>

          {graph.importReport.issues.length > 0 ? (
            <ul className="island-notice island-notice--warning mt-4 space-y-1 p-3 text-xs font-medium">
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

        <section className="island-card min-w-0 overflow-hidden p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-island-ink">Core action mapping</h2>
              <p className="mt-2 text-xs font-medium text-island-muted">
                Click an action in the browser, preview it, then assign it to a
                Tomoji behavior.
              </p>
            </div>
            <p className="max-w-xs text-xs font-medium text-island-muted">
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
                  className="island-form-section min-w-0 p-3"
                >
                  <div className="flex items-center gap-3">
                    <ShimejiGraphActionThumb
                      graph={graph}
                      actionName={mappedActionName}
                      resolvePoseUrl={resolvePoseUrl}
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-island-muted">
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
                        className="mt-1 block max-w-full truncate text-left text-sm font-extrabold text-island-ink disabled:text-island-muted"
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
                      className="island-button island-button--soft min-h-8 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      Use previewed action
                    </button>
                    <button
                      type="button"
                      disabled={!mappedActionName}
                      onClick={() => clearIntent(intent)}
                      className="island-button island-button--soft min-h-8 px-3 py-1.5 text-xs text-red-700 hover:border-red-700/50 hover:text-red-800 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="island-card min-w-0 overflow-hidden p-5 xl:col-start-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-island-ink">
                Context menu actions
              </h2>
              <p className="mt-2 text-xs font-medium text-island-muted">
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
              className="island-button island-button--primary min-h-9 px-4 py-2 text-xs disabled:opacity-40"
            >
              {selectedIsMenuAction ? "Remove previewed" : "Add previewed"}
            </button>
          </div>

          {menuActionNames.length > 0 ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {menuActionNames.map((actionName, index) => (
                <div
                  key={actionName}
                  className="island-form-section flex items-center gap-3 p-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-island-custard text-[10px] font-extrabold text-island-ink">
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
                    className="min-w-0 flex-1 truncate text-left text-sm font-extrabold text-island-ink hover:text-island-muted"
                    title={actionName}
                  >
                    {actionName}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMenuAction(actionName)}
                    className="island-button island-button--soft min-h-7 px-2 py-1 text-[10px] text-red-700 hover:border-red-700/50 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-island-ink/30 px-3 py-4 text-center text-xs font-medium text-island-muted">
              No menu actions selected yet.
            </p>
          )}
        </section>
      </div>

      {saveError ? (
        <p className="island-notice island-notice--error mt-6 px-4 py-2 text-sm font-medium">
          {saveError}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
