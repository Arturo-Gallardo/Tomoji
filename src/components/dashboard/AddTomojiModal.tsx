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
      description:
        "Start from your own sprite folder, assign actions, then save as an editable native Tomoji.",
      onSelect: onCreateTomoji,
    },
    {
      id: "import-shimeji",
      label: "Import Shimeji pack",
      description:
        "PC or Android Shimeji. Preserves original actions, timing, sprites, and movement.",
      onSelect: onImportShimeji,
    },
    {
      id: "import-tomoji",
      label: "Import Tomoji folder",
      description: "Restore an already-converted Tomoji character folder.",
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
              Make your own editable Tomoji, import Shimeji, or restore a
              Tomoji folder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-xl leading-none text-island-muted hover:bg-island-orange hover:text-island-ink"
            aria-label="Close"
          >
            ×
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
