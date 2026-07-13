import { useEffect, useMemo, useState } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useCompanionInstances } from "../../hooks/useCompanionInstances";
import { openCharactersFolder } from "../../services/tomojiStorage";
import { ShimejiFolderImportScreen } from "../import/ShimejiFolderImportScreen";
import { TomojiImportScreen } from "../import/TomojiImportScreen";
import { IslandIcon } from "../ui/IslandIcon";
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

function TomojiQuickStart({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mb-8 grid gap-3 md:grid-cols-3">
      {[
        {
          number: "1",
          title: "Invite",
          body: "Use Shimeji import for PC or Android packs. Use Tomoji folder for backups.",
        },
        {
          number: "2",
          title: "Switch on",
          body: "Turn cards on to spawn them. Turn off before heavy editing.",
        },
        {
          number: "3",
          title: "Make it yours",
          body: "Open Edit to adjust size, speed, dialogue, and random behavior.",
        },
      ].map((item) => (
        <div
          key={item.title}
          className="island-surface flex gap-3 p-4"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-island-ink/25 bg-island-custard text-sm font-extrabold">
            {item.number}
          </span>
          <span>
            <span className="block text-sm font-extrabold text-island-ink">{item.title}</span>
            <span className="mt-1 block text-xs font-medium leading-relaxed text-island-muted">
              {item.body}
            </span>
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="island-button island-button--primary justify-start rounded-2xl p-4 text-left md:hidden"
      >
        <IslandIcon name="plus" className="h-5 w-5" />
        <span>
          <span className="block text-sm font-extrabold">Add first Tomoji</span>
          <span className="mt-1 block text-xs text-white/80">Import a character pack.</span>
        </span>
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

  useEffect(() => {
    if (lastImportMessage === null) {
      return;
    }

    const timeout = window.setTimeout(() => setLastImportMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [lastImportMessage]);

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
        className="island-icon-button h-10 w-10"
        aria-label={isRefreshing ? "Refreshing Tomojis" : "Refresh Tomojis"}
        title={isRefreshing ? "Refreshing Tomojis" : "Refresh Tomojis"}
      >
        <IslandIcon
          name="refresh"
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
      </button>
      <button
        type="button"
        onClick={() => void openCharactersFolder()}
        className="island-button island-button--soft min-h-10 px-3 py-2 text-sm"
      >
        <IslandIcon name="folder" className="h-4 w-4" />
        <span className="hidden sm:inline">Open Tomojis folder</span>
        <span className="sm:hidden">Folder</span>
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
        key="archive"
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
          <div className="island-card mx-auto max-w-lg p-8 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-island-custard">
              <IslandIcon name="archive" className="h-6 w-6" />
            </span>
            <p className="text-base font-extrabold text-island-ink">Archive is empty</p>
            <p className="mt-2 text-sm font-medium text-island-muted">
              Archive companions from a card menu to hide them without deleting files.
            </p>
          </div>
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
      key="list"
      header={
        <TomojiPageHeader
          title="Your Tomojis"
            subtitle={companionCountLabel(activeInstances.length)}
          trailing={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFlow("archive")}
                className="island-icon-button relative h-10 w-10"
                aria-label="View archived Tomojis"
                title="View archived Tomojis"
              >
                <IslandIcon name="archive" className="h-4 w-4" />
                {archivedInstances.length > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-island-orange px-1 text-center text-[10px] font-bold leading-4 text-island-ink"
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
          <p className="mb-4 max-w-xl text-sm font-medium text-island-muted">
            Click a card to toggle it on or off, edit behavior, or import new
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
            className="w-full rounded-xl border-2 border-island-ink/30 bg-island-paper px-3 py-2 text-sm font-medium text-island-ink outline-none placeholder:text-island-muted/70 focus:border-island-ink"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSetAllActive(true)}
            disabled={activeInstances.length === 0}
            className="island-button island-button--soft min-h-10 px-3 py-2 text-sm"
          >
            Turn all on
          </button>
          <button
            type="button"
            onClick={() => void handleSetAllActive(false)}
            disabled={activeInstances.length === 0}
            className="island-button island-button--soft min-h-10 px-3 py-2 text-sm"
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
        <p className="mt-6 rounded-xl border-2 border-dashed border-island-ink/30 bg-island-paper/70 px-4 py-6 text-center text-sm font-medium text-island-muted">
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

      {lastImportMessage ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6">
          <p className="island-dialog max-w-sm px-5 py-3 text-center text-sm font-extrabold text-island-ink" role="status">
            {lastImportMessage}
          </p>
        </div>
      ) : null}
    </TomojiPageLayout>
  );
}
