import { IslandIcon } from "../ui/IslandIcon";

interface AddTomojiModalProps {
  onClose: () => void;
  onCreateTomoji: () => void;
  onImportTomoji: () => void;
  onImportShimeji: () => void;
}

interface AddOption {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export function AddTomojiModal({
  onClose,
  onCreateTomoji,
  onImportTomoji,
  onImportShimeji,
}: AddTomojiModalProps) {
  const options: AddOption[] = [
    {
      id: "create-tomoji",
      label: "Create new Tomoji",
      description: "Build from sprites and assign actions.",
      onSelect: onCreateTomoji,
    },
    {
      id: "import-shimeji",
      label: "Import downloaded Shimeji (PC or Android)",
      description: "Use this for a character pack you downloaded. ZIP/RAR? Extract it first.",
      onSelect: onImportShimeji,
    },
    {
      id: "import-tomoji",
      label: "Restore Tomoji backup folder",
      description: "Only use this for a Tomoji folder with manifest.json and sprites.",
      onSelect: onImportTomoji,
    },
  ];

  return (
    <div
      role="presentation"
      className="island-dialog-backdrop absolute inset-0 z-20 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Add a Tomoji"
        className="island-dialog w-full max-w-md p-5 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-island-ink">Add a Tomoji</h2>
            <p className="mt-1 text-xs font-medium text-island-muted">
              Create, import, or restore a Tomoji.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-island-ink/20 bg-island-orange text-2xl font-black leading-none text-island-ink transition hover:border-island-ink/45 hover:bg-island-orange/75"
            aria-label="Close"
          >
            <IslandIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={option.onSelect}
              className="rounded-lg border-2 border-island-ink/25 bg-island-paper px-4 py-3 text-left transition duration-150 enabled:hover:border-island-ink/55 enabled:hover:bg-island-orange/35 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <p className="text-sm font-extrabold text-island-ink">{option.label}</p>
              <p className="text-xs font-medium text-island-muted">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
