import { useState } from "react";
import { useCompanionInstances } from "../../hooks/useCompanionInstances";
import { openCharactersFolder } from "../../services/tomojiStorage";
import { ShimejiFolderImportScreen } from "../import/ShimejiFolderImportScreen";
import { TomojiImportScreen } from "../import/TomojiImportScreen";
import { AddTomojiModal } from "./AddTomojiModal";
import { CharacterFrameEditor } from "./CharacterFrameEditor";
import { CharacterSettingsEditor } from "./CharacterSettingsEditor";
import { TomojiGrid } from "./TomojiGrid";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";

type TomojiFlow =
  | "list"
  | "archive"
  | "add"
  | "importTomoji"
  | "importShimeji"
  | "edit"
  | "editFrames";

function companionCountLabel(count: number): string {
  return `${count} companion${count === 1 ? "" : "s"}`;
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5h18v4H3z" />
      <path d="M5 9v10h14V9" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function TomojisView() {
  const {
    instances,
    activeInstances,
    archivedInstances,
    addCompanion,
    removeCompanion,
    toggleCompanion,
    updateCompanion,
    archiveCompanion,
    unarchiveCompanion,
    reorderCompanions,
    refreshFromDisk,
  } = useCompanionInstances();
  const [flow, setFlow] = useState<TomojiFlow>("list");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingInstance = instances.find((instance) => instance.id === editingId);

  const handleImported = async (characterId: string) => {
    await addCompanion(characterId);
    setFlow("list");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFromDisk();
    } finally {
      setIsRefreshing(false);
    }
  };

  const folderActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={isRefreshing}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:border-white hover:text-white disabled:cursor-wait disabled:opacity-50"
        aria-label={isRefreshing ? "Refreshing Tomojis" : "Refresh Tomojis"}
        title={isRefreshing ? "Refreshing Tomojis" : "Refresh Tomojis"}
      >
        <RefreshIcon spinning={isRefreshing} />
      </button>
      <button
        type="button"
        onClick={() => void openCharactersFolder()}
        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-white hover:text-white"
      >
        Open Tomojis folder
      </button>
    </div>
  );

  if (flow === "editFrames" && editingInstance) {
    return (
      <CharacterFrameEditor
        characterId={editingInstance.characterId}
        characterName={editingInstance.name}
        onClose={() => setFlow("edit")}
        onSaved={() => setFlow("edit")}
      />
    );
  }

  if (flow === "edit" && editingInstance) {
    return (
      <CharacterSettingsEditor
        instance={editingInstance}
        onClose={() => setFlow("list")}
        onEditFrames={() => setFlow("editFrames")}
        onSave={updateCompanion}
      />
    );
  }

  if (flow === "importTomoji") {
    return (
      <TomojiImportScreen
        onClose={() => setFlow("list")}
        onImported={handleImported}
      />
    );
  }

  if (flow === "importShimeji") {
    return (
      <ShimejiFolderImportScreen
        onClose={() => setFlow("list")}
        onImported={handleImported}
      />
    );
  }

  if (flow === "archive") {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title="Archived Tomojis"
            subtitle={companionCountLabel(archivedInstances.length)}
            onBack={() => setFlow("list")}
            trailing={folderActions}
          />
        }
      >
        {archivedInstances.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No archived tomojis. Archive companions from their card menu to hide
            them here without deleting.
          </p>
        ) : (
          <TomojiGrid
            instances={archivedInstances}
            onDelete={removeCompanion}
            onToggle={toggleCompanion}
            onEdit={(id) => {
              setEditingId(id);
              setFlow("edit");
            }}
            onRestore={(id) => void unarchiveCompanion(id)}
          />
        )}
      </TomojiPageLayout>
    );
  }

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title="Your Tomojis"
          subtitle={companionCountLabel(activeInstances.length)}
          trailing={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFlow("archive")}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:border-white hover:text-white"
                aria-label="View archived Tomojis"
                title="View archived Tomojis"
              >
                <ArchiveIcon />
                {archivedInstances.length > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-white px-1 text-center text-[10px] font-bold leading-4 text-black"
                    aria-hidden
                  >
                    {archivedInstances.length}
                  </span>
                ) : null}
              </button>
              {folderActions}
            </div>
          }
        />
      }
    >
      <p className="mb-8 max-w-xl text-sm text-neutral-400">
        Toggle companions on or off, edit behavior, or import new characters.
        Drag cards to rearrange.
      </p>

      <TomojiGrid
        instances={activeInstances}
        reorderable
        onReorder={(orderedIds) => void reorderCompanions(orderedIds)}
        onDelete={removeCompanion}
        onToggle={toggleCompanion}
        onEdit={(id) => {
          setEditingId(id);
          setFlow("edit");
        }}
        onArchive={(id) => void archiveCompanion(id)}
        onAdd={() => setFlow("add")}
      />

      {flow === "add" ? (
        <AddTomojiModal
          onClose={() => setFlow("list")}
          onImportTomoji={() => setFlow("importTomoji")}
          onImportShimeji={() => setFlow("importShimeji")}
        />
      ) : null}
    </TomojiPageLayout>
  );
}
