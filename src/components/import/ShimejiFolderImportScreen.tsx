import { useCallback, useEffect, useState } from "react";
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
  type ShimejiGraphImportScan,
} from "../../services/shimejiGraphImporter";

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

function FolderTreeExample() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <p className="mb-3 text-sm font-bold text-white">
        Select the folder with sprites + actions
      </p>
      <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-neutral-300">
{`Shimeji Folder/
├─ Shimeji-ee.jar
├─ conf/
└─ img/
   └─ Character Folder/     ← choose this if it has conf/
      ├─ conf/
      │  ├─ actions.xml     ← required
      │  └─ behaviors.xml
      ├─ shime1.png     ← PNG recommended; JPG/WebP/BMP also work
      ├─ shime2.webp
      └─ ...`}
      </pre>
      <p className="mt-3 text-xs text-neutral-500">
        Best import needs both <span className="text-neutral-300">conf/actions.xml</span>{" "}
        and the <span className="text-neutral-300">img</span> sprites. If{" "}
        <span className="text-neutral-300">conf</span> is outside{" "}
        <span className="text-neutral-300">img</span>, choose the outer folder;
        Tomoji will still pick the correct img sprite folder internally.
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Tomoji reads <span className="text-neutral-300">actions.xml</span> for
        frame order, durations, and movement. JAR files stay ignored.
      </p>
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
    [actionsXmlPath, behaviorsXmlPath, isImporting, isLoadingFolder],
  );

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
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <div
            className={`rounded-2xl border border-dashed p-6 transition ${
              isDropActive
                ? "border-white bg-white/10"
                : "border-neutral-700 bg-neutral-900/40"
            }`}
          >
            <p className="text-sm font-bold text-white">
              Drop the Shimeji folder here
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Select the folder that includes{" "}
              <span className="text-neutral-200">conf/actions.xml</span> and{" "}
              <span className="text-neutral-200">img</span>. If the character
              folder inside <span className="text-neutral-200">img</span> has
              its own <span className="text-neutral-200">conf</span>, choose
              that character folder. If sprites and{" "}
              <span className="text-neutral-200">actions.xml</span> are split,
              choose both with the buttons below.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isLoadingFolder || isImporting}
                onClick={() => void handleChooseFolder()}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {isLoadingFolder ? "Reading..." : "Choose Shimeji folder"}
              </button>
              <button
                type="button"
                disabled={isLoadingFolder || isImporting}
                onClick={() => void handleChooseActionsFile()}
                className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Choose actions XML
              </button>
              <button
                type="button"
                disabled={isLoadingFolder || isImporting}
                onClick={() => void handleChooseBehaviorsFile()}
                className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Choose behaviors XML
              </button>
            </div>
            {actionsXmlPath ? (
              <p className="mt-3 text-xs text-neutral-500">
                Selected actions XML: {actionsXmlPath}
              </p>
            ) : null}
            {behaviorsXmlPath ? (
              <p className="mt-2 text-xs text-neutral-500">
                Selected behaviors XML: {behaviorsXmlPath}
              </p>
            ) : null}
            {scan ? (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-black/20 p-4">
                <p
                  className={`text-sm font-bold ${
                    scan.status === "ready"
                      ? "text-emerald-300"
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

          {draft ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
              <label className="block text-sm font-bold text-white">
                Tomoji name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-white"
                  placeholder={draft.name}
                />
              </label>
              <p className="mt-2 text-xs text-neutral-500">
                Default comes from folder name. Change it before importing if
                you want.
              </p>
              <p className="mt-4 text-xs text-neutral-400">
                Parsed {draft.graph.importReport.actionsParsed} actions,{" "}
                {draft.graph.importReport.behaviorsParsed} behaviors, and{" "}
                {draft.graph.importReport.posesParsed} poses. Runtime canvas:{" "}
                {draft.graph.spriteCanvas.width}x{draft.graph.spriteCanvas.height},
                scale {draft.scale.toFixed(2)}x.
              </p>
              {draft.graph.menuActions.length > 0 ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Menu animations:{" "}
                  {draft.graph.menuActions
                    .map((action) => action.label)
                    .join(", ")}
                </p>
              ) : null}
              {draft.graph.importReport.issues.length > 0 ? (
                <ul className="mt-3 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {draft.graph.importReport.issues.map((issue) => (
                    <li key={issue.message}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                disabled={isImporting || name.trim() === ""}
                onClick={() => void handleImport()}
                className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {isImporting ? "Importing..." : "Import as Tomoji"}
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        <FolderTreeExample />
      </div>
    </TomojiPageLayout>
  );
}
