import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TomojiPageHeader } from "../dashboard/TomojiPageHeader";
import { TomojiPageLayout } from "../dashboard/TomojiPageLayout";
import {
  analyzeShimejiGraphImportSelection,
  buildShimejiGraphDraftFromFolder,
  convertShimejiGraphDraft,
  pickShimejiGraphActionsFile,
  pickShimejiGraphBehaviorsFile,
  pickShimejiGraphFolder,
  type ShimejiGraphDraft,
  type ShimejiImportFormat,
  type ShimejiGraphImportScan,
} from "../../services/shimejiGraphImporter";
import { toAssetUrl } from "../../services/fs/fileSystemAdapter";
import {
  ShimejiGraphActionBrowser,
  ShimejiGraphActionPreview,
} from "../shimejiGraph/ShimejiGraphActionPreview";
import type { ShimejiGraphPose } from "../../types/shimejiGraph";

interface ShimejiFolderImportScreenProps {
  onClose: () => void;
  onImported: (characterId: string) => void | Promise<void>;
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message;
  }

  if (typeof caught === "string") {
    return caught;
  }

  return "import failed";
}

const FORMAT_LABELS: Record<ShimejiImportFormat, string> = {
  pc: "PC Shimeji",
  android: "Android Shimeji",
};

function FolderTreeExample({ format }: { format: ShimejiImportFormat }) {
  const isAndroid = format === "android";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <p className="mb-3 text-sm font-bold text-white">
        Select the {FORMAT_LABELS[format]} folder
      </p>
      <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-neutral-300">
{isAndroid
  ? `Android Shimeji folder/
|-- manifest.json       <- required
|-- animation.json      <- required
|-- thumbnail.webp
|-- sprites/
|   |-- 0000.webp
|   |-- 0001.webp
|   |-- ...`
  : `PC Shimeji folder/
|-- Shimeji-ee.jar      <- ignored
|-- conf/
|   |-- actions.xml     <- required
|   |-- behaviors.xml   <- optional, better import
|-- img/
|   |-- Character/
|   |   |-- shime1.png
|   |   |-- shime2.png
|   |   |-- ...`}
      </pre>
      {isAndroid ? (
        <p className="mt-3 text-xs text-neutral-500">
          Choose the folder that directly contains{" "}
          <span className="text-neutral-300">manifest.json</span>. Tomoji reads{" "}
          <span className="text-neutral-300">animation.json</span> for frame
          order, timing, movement, and menu actions.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-neutral-500">
            Choose the folder that contains{" "}
            <span className="text-neutral-300">conf</span> and{" "}
            <span className="text-neutral-300">img</span>. If the character
            folder inside <span className="text-neutral-300">img</span> has its
            own <span className="text-neutral-300">conf</span>, choose that
            character folder instead.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Tomoji reads <span className="text-neutral-300">actions.xml</span>{" "}
            for frame order, durations, and movement. JAR files stay ignored.
          </p>
        </>
      )}
    </div>
  );
}

function importErrorHelp(format: ShimejiImportFormat): string {
  return format === "android"
    ? "For Android, choose the folder with manifest.json, animation.json, and sprites/."
    : "For PC, choose the folder with conf/actions.xml and img/, or manually pick the XML files.";
}

function ImportPreview({ draft }: { draft: ShimejiGraphDraft }) {
  const initialActionName = useMemo(
    () =>
      draft.graph.defaultActions.idle ??
      draft.graph.defaultActions.walk ??
      Object.keys(draft.graph.actions)[0] ??
      null,
    [draft],
  );
  const [selectedActionName, setSelectedActionName] = useState<string | null>(
    initialActionName,
  );

  useEffect(() => {
    setSelectedActionName(initialActionName);
  }, [initialActionName]);

  const resolvePoseUrl = useCallback((pose: ShimejiGraphPose) => {
    return pose.source ? toAssetUrl(pose.source) : null;
  }, []);

  return (
    <div className="mt-4 min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ShimejiGraphActionBrowser
          graph={draft.graph}
          selectedActionName={selectedActionName}
          onSelect={setSelectedActionName}
          resolvePoseUrl={resolvePoseUrl}
        />
        <ShimejiGraphActionPreview
          graph={draft.graph}
          actionName={selectedActionName}
          resolvePoseUrl={resolvePoseUrl}
        />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-black/20 p-4 text-xs text-neutral-400">
        <p>
          Runtime canvas: {draft.graph.spriteCanvas.width}x
          {draft.graph.spriteCanvas.height}
        </p>
        <p className="mt-1">
          Imported: {draft.graph.importReport.actionsParsed} actions,{" "}
          {draft.graph.importReport.posesParsed} poses
        </p>
        {draft.graph.baseDisplayScale && draft.graph.baseDisplayScale < 1 ? (
          <p className="mt-1 text-island-orange">
            1x uses a fitted desktop size, with full-resolution sprites preserved.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ShimejiFolderImportScreen({
  onClose,
  onImported,
}: ShimejiFolderImportScreenProps) {
  const [draft, setDraft] = useState<ShimejiGraphDraft | null>(null);
  const [name, setName] = useState("");
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importFormat, setImportFormat] = useState<ShimejiImportFormat>("pc");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null,
  );
  const [actionsXmlPath, setActionsXmlPath] = useState<string | null>(null);
  const [behaviorsXmlPath, setBehaviorsXmlPath] = useState<string | null>(
    null,
  );
  const [scan, setScan] = useState<ShimejiGraphImportScan | null>(null);

  const loadFolder = useCallback(
    async (
      folderPath: string,
      nextActionsXmlPath = actionsXmlPath,
      nextBehaviorsXmlPath = behaviorsXmlPath,
    ) => {
      if (isLoadingFolder || isImporting) {
        return;
      }

      setIsLoadingFolder(true);
      setError(null);
      try {
        const nextScan = await analyzeShimejiGraphImportSelection(
          folderPath,
          importFormat,
          nextActionsXmlPath,
          nextBehaviorsXmlPath,
        );
        setSelectedFolderPath(folderPath);
        setScan(nextScan);

        if (nextScan.status !== "ready") {
          setDraft(null);
          return;
        }

        const nextDraft = await buildShimejiGraphDraftFromFolder(
          folderPath,
          importFormat,
          nextScan.actionsXmlPath,
          nextScan.behaviorsXmlPath,
        );
        setDraft(nextDraft);
        setName(nextDraft.name);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setIsLoadingFolder(false);
      }
    },
    [actionsXmlPath, behaviorsXmlPath, importFormat, isImporting, isLoadingFolder],
  );

  const handleFormatChange = (nextFormat: ShimejiImportFormat) => {
    setImportFormat(nextFormat);
    setDraft(null);
    setScan(null);
    setError(null);
    setSelectedFolderPath(null);
    setActionsXmlPath(null);
    setBehaviorsXmlPath(null);
  };

  const handleImport = async () => {
    if (draft === null || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const characterId = await convertShimejiGraphDraft(
        draft,
        name.trim() || draft.name,
      );
      await onImported(characterId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsImporting(false);
    }
  };

  const handleChooseFolder = async () => {
    const folderPath = await pickShimejiGraphFolder();
    if (folderPath === null) {
      return;
    }

    await loadFolder(folderPath);
  };

  const handleChooseActionsFile = async () => {
    const filePath = await pickShimejiGraphActionsFile();
    if (filePath === null) {
      return;
    }

    setActionsXmlPath(filePath);
    if (selectedFolderPath !== null) {
      await loadFolder(selectedFolderPath, filePath, behaviorsXmlPath);
    }
  };

  const handleChooseBehaviorsFile = async () => {
    const filePath = await pickShimejiGraphBehaviorsFile();
    if (filePath === null) {
      return;
    }

    setBehaviorsXmlPath(filePath);
    if (selectedFolderPath !== null) {
      await loadFolder(selectedFolderPath, actionsXmlPath, filePath);
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDropActive(true);
          return;
        }

        setIsDropActive(false);

        if (event.payload.type !== "drop") {
          return;
        }

        const [folderPath] = event.payload.paths;
        if (folderPath) {
          void loadFolder(folderPath);
        }
      })
      .then((stopListening) => {
        unlisten = stopListening;
      })
      .catch(() => {
        // choose-folder still works if native drag/drop is unavailable
      });

    return () => {
      unlisten?.();
    };
  }, [loadFolder]);

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title="Import Shimeji"
          subtitle="Auto-convert a Shimeji folder into Tomoji"
          onBack={onClose}
        />
      }
    >
      <div className="shimeji-import-screen grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-5">
          <div
            className={`rounded-2xl border border-dashed p-6 transition ${
              isDropActive
                ? "border-island-orange bg-island-custard/70"
                : "border-island-ink/30 bg-island-paper/80"
            }`}
          >
            <label className="block text-sm font-extrabold text-island-ink">
              Shimeji type
              <select
                value={importFormat}
                disabled={isLoadingFolder || isImporting}
                onChange={(event) =>
                  handleFormatChange(event.target.value as ShimejiImportFormat)
                }
                className="island-select mt-2 px-3 py-2 text-sm"
              >
                <option value="pc">PC Shimeji (actions.xml + img)</option>
                <option value="android">
                  Android Shimeji (manifest.json + sprites)
                </option>
              </select>
            </label>
            <p className="mt-5 text-sm font-extrabold text-island-ink">
              Drop the {FORMAT_LABELS[importFormat]} folder here
            </p>
            <p className="mt-2 text-sm leading-relaxed text-island-muted">
              {importFormat === "android" ? (
                <>
                  Select the folder with{" "}
                  <span className="font-bold text-island-ink">manifest.json</span>,{" "}
                  <span className="text-neutral-200">animation.json</span>, and{" "}
                  <span className="text-neutral-200">sprites</span>. No XML
                  files needed.
                </>
              ) : (
                <>
                  Select the folder with{" "}
                  <span className="text-neutral-200">conf/actions.xml</span>{" "}
                  and <span className="text-neutral-200">img</span>. If XML and
                  sprites are split, choose the folder first, then choose the
                  XML files below.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isLoadingFolder || isImporting}
                onClick={() => void handleChooseFolder()}
                className="island-button island-button--primary disabled:opacity-50"
              >
                {isLoadingFolder
                  ? "Reading..."
                  : `Choose ${FORMAT_LABELS[importFormat]} folder`}
              </button>
              {importFormat === "pc" ? (
                <>
                  <button
                    type="button"
                    disabled={isLoadingFolder || isImporting}
                    onClick={() => void handleChooseActionsFile()}
                    className="island-button island-button--soft disabled:opacity-50"
                  >
                    Choose actions XML
                  </button>
                  <button
                    type="button"
                    disabled={isLoadingFolder || isImporting}
                    onClick={() => void handleChooseBehaviorsFile()}
                    className="island-button island-button--soft disabled:opacity-50"
                  >
                    Choose behaviors XML
                  </button>
                </>
              ) : null}
            </div>
            {importFormat === "pc" && actionsXmlPath ? (
              <p className="mt-3 text-xs text-neutral-500">
                Selected actions XML: {actionsXmlPath}
              </p>
            ) : null}
            {importFormat === "pc" && behaviorsXmlPath ? (
              <p className="mt-2 text-xs text-neutral-500">
                Selected behaviors XML: {behaviorsXmlPath}
              </p>
            ) : null}
            {scan ? (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-black/20 p-4">
                <p
                  className={`text-sm font-bold ${
                    scan.status === "ready"
                      ? "text-island-orange"
                      : "text-amber-300"
                  }`}
                >
                  {scan.status === "ready"
                    ? "Ready to import"
                    : scan.status === "missingActions"
                      ? "Need actions.xml"
                      : "Need sprite images"}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-neutral-400">
                  {scan.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <p>{error}</p>
              <p className="mt-2 text-xs text-red-200/80">
                {importErrorHelp(importFormat)}
              </p>
            </div>
          ) : null}
        </div>

        <FolderTreeExample format={importFormat} />

        {draft ? (
          <div className="island-card min-w-0 overflow-hidden p-5 lg:col-span-2">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <label className="block text-sm font-extrabold text-island-ink">
                  Tomoji name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="island-input mt-2 px-3 py-2 text-sm"
                    placeholder={draft.name}
                  />
                </label>
                <p className="mt-2 text-xs font-medium text-island-muted">
                  Default comes from folder name. Change it before importing if
                  you want.
                </p>
                <p className="mt-4 text-xs font-medium text-island-muted">
                  Parsed {draft.graph.importReport.actionsParsed} actions,{" "}
                  {draft.graph.importReport.behaviorsParsed} behaviors, and{" "}
                  {draft.graph.importReport.posesParsed} poses. Runtime canvas:{" "}
                  {draft.graph.spriteCanvas.width}x
                  {draft.graph.spriteCanvas.height}, scale{" "}
                  {draft.scale.toFixed(2)}x.
                </p>
                <p className="mt-2 text-xs font-medium text-island-muted">
                  Graph imports keep original action timing and frame order.
                  Preview actions below; individual frames are not edited in this
                  flow.
                </p>
                {draft.graph.menuActions.length > 0 ? (
                  <p className="mt-2 text-xs font-medium text-island-muted">
                    Menu animations:{" "}
                    {draft.graph.menuActions
                      .map((action) => action.label)
                      .join(", ")}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={isImporting || name.trim() === ""}
                  onClick={() => void handleImport()}
                  className="island-button island-button--primary mt-5 disabled:opacity-50"
                >
                  {isImporting ? "Importing..." : "Import as Tomoji"}
                </button>
              </div>

              <div>
                {draft.graph.importReport.issues.length > 0 ? (
                  <ul className="island-notice island-notice--warning space-y-1 p-3 text-xs font-medium text-island-ink">
                    {draft.graph.importReport.issues.map((issue) => (
                      <li key={issue.message}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <ImportPreview draft={draft} />
          </div>
        ) : null}
      </div>
    </TomojiPageLayout>
  );
}
