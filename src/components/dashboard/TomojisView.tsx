import { useMemo, useState } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useCompanionInstances } from "../../hooks/useCompanionInstances";
import { openCharactersFolder } from "../../services/tomojiStorage";
import { ShimejiFolderImportScreen } from "../import/ShimejiFolderImportScreen";
import { TomojiImportScreen } from "../import/TomojiImportScreen";
import { ShimejiImportWizard } from "../wizard/ShimejiImportWizard";
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
  | "createTomoji"
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

function TomojiQuickStart({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mb-8 grid gap-3 md:grid-cols-3">
      {[
        {
          title: "1. Import",
          body: "Use Shimeji import for PC or Android packs. Use Tomoji folder for backups.",
        },
        {
          title: "2. Toggle",
          body: "Turn cards on to spawn them. Turn off before heavy editing.",
        },
        {
          title: "3. Tune",
          body: "Open Edit to adjust size, speed, dialogue, and random behavior.",
        },
      ].map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4"
        >
          <p className="text-sm font-bold text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {item.body}
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-2xl border border-dashed border-neutral-600 bg-neutral-950 p-4 text-left transition hover:border-white hover:bg-neutral-900 md:hidden"
      >
        <p className="text-sm font-bold text-white">Add first Tomoji</p>
        <p className="mt-1 text-xs text-neutral-500">Import a character pack.</p>
      </button>
    </div>
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
    setAllActiveCompanionsEnabled,
    updateCompanion,
    archiveCompanion,
    unarchiveCompanion,
    reorderCompanions,
    refreshFromDisk,
    isLoading,
  } = useCompanionInstances();
  const { settings } = useAppSettings();
  const [flow, setFlow] = useState<TomojiFlow>("list");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastImportMessage, setLastImportMessage] = useState<string | null>(null);
  const editingInstance = instances.find((instance) => instance.id === editingId);
  const filteredActiveInstances = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query === "") {
      return activeInstances;
    }

    return activeInstances.filter((instance) =>
      `${instance.name} ${instance.characterId}`.toLowerCase().includes(query),
    );
  }, [activeInstances, searchTerm]);

  const handleImported = async (characterId: string) => {
    await addCompanion(characterId);
    setLastImportMessage(`Imported ${characterId}. Toggle it on when ready.`);
    setFlow("list");
  };

  const handleSetAllActive = async (enabled: boolean) => {
    await setAllActiveCompanionsEnabled(enabled);
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

  if (flow === "createTomoji") {
    return (
      <ShimejiImportWizard
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
            confirmBeforeDelete={settings?.confirmBeforeDelete}
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
      {settings?.showHelperTips !== false ? (
        <>
          <p className="mb-4 max-w-xl text-sm text-neutral-400">
            Toggle companions on or off, edit behavior, or import new
            characters. Drag cards to rearrange.
          </p>
          {!isLoading && activeInstances.length === 0 ? (
            <TomojiQuickStart onAdd={() => setFlow("add")} />
          ) : null}
        </>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search Tomojis</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search Tomojis..."
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-white"
          />
        </label>
        {lastImportMessage ? (
          <p className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
            {lastImportMessage}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSetAllActive(true)}
            disabled={activeInstances.length === 0}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Turn all on
          </button>
          <button
            type="button"
            onClick={() => void handleSetAllActive(false)}
            disabled={activeInstances.length === 0}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Turn all off
          </button>
        </div>
      </div>

      <TomojiGrid
        instances={filteredActiveInstances}
        reorderable={searchTerm.trim() === ""}
        onReorder={(orderedIds) => void reorderCompanions(orderedIds)}
        onDelete={removeCompanion}
        onToggle={toggleCompanion}
        onEdit={(id) => {
          setEditingId(id);
          setFlow("edit");
        }}
        onArchive={(id) => void archiveCompanion(id)}
        onAdd={() => setFlow("add")}
        confirmBeforeDelete={settings?.confirmBeforeDelete}
      />

      {searchTerm.trim() !== "" && filteredActiveInstances.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-500">
          No Tomojis match “{searchTerm.trim()}”.
        </p>
      ) : null}

      {flow === "add" ? (
        <AddTomojiModal
          onClose={() => setFlow("list")}
          onCreateTomoji={() => setFlow("createTomoji")}
          onImportTomoji={() => setFlow("importTomoji")}
          onImportShimeji={() => setFlow("importShimeji")}
        />
      ) : null}
    </TomojiPageLayout>
  );
}
