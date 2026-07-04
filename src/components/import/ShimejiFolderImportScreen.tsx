import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TomojiPageHeader } from "../dashboard/TomojiPageHeader";
import { TomojiPageLayout } from "../dashboard/TomojiPageLayout";
import {
  buildShimejiDraftFromFolder,
  convertShimejiDraft,
  pickShimejiFolder,
} from "../../services/shimejiImporter";
import type { ShimejiDraft } from "../../types/shimejiDraft";

interface ShimejiFolderImportScreenProps {
  onClose: () => void;
  onImported: (characterId: string) => void | Promise<void>;
}

function FolderTreeExample() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <p className="mb-3 text-sm font-bold text-white">
        Select this kind of folder
      </p>
      <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-neutral-300">
{`Shimeji Folder/            ← this works
├─ Shimeji-ee.jar
├─ conf/
└─ img/
   └─ Character Folder/     ← this also works
      ├─ conf/
      │  ├─ actions.xml     ← required
      │  └─ behaviors.xml
      ├─ shime1.png
      ├─ shime2.png
      └─ ...`}
      </pre>
      <p className="mt-3 text-xs text-neutral-500">
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
  const [draft, setDraft] = useState<ShimejiDraft | null>(null);
  const [name, setName] = useState("");
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolder = useCallback(
    async (folderPath: string) => {
      if (isLoadingFolder || isImporting) {
        return;
      }

      setIsLoadingFolder(true);
      setError(null);
      try {
        const nextDraft = await buildShimejiDraftFromFolder(folderPath);
        setDraft(nextDraft);
        setName(nextDraft.name);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "import failed");
      } finally {
        setIsLoadingFolder(false);
      }
    },
    [isImporting, isLoadingFolder],
  );

  const handleImport = async () => {
    if (draft === null || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const characterId = await convertShimejiDraft({
        ...draft,
        name: name.trim() || draft.name,
      });
      await onImported(characterId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleChooseFolder = async () => {
    const folderPath = await pickShimejiFolder();
    if (folderPath === null) {
      return;
    }

    await loadFolder(folderPath);
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
          subtitle="Auto-convert a full Shimeji character folder into Tomoji"
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
              Or click below and select either the outer Shimeji folder or the
              character folder inside <span className="text-neutral-200">img</span>.
            </p>
            <button
              type="button"
              disabled={isLoadingFolder || isImporting}
              onClick={() => void handleChooseFolder()}
              className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {isLoadingFolder ? "Reading..." : "Choose Shimeji folder"}
            </button>
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
                Found {draft.sources.length} frames at {draft.frameWidth}x
                {draft.frameHeight}, scale {draft.scale.toFixed(2)}x.
              </p>
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
