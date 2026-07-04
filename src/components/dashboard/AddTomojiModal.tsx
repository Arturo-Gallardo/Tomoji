interface AddTomojiModalProps {
  onClose: () => void;
  onCreateNew: () => void;
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
  onCreateNew,
  onImportTomoji,
  onImportShimeji,
}: AddTomojiModalProps) {
  const options: AddOption[] = [
    {
      id: "create",
      label: "Create New",
      description: "Pick frames manually and build animations",
      onSelect: onCreateNew,
    },
    {
      id: "import-tomoji",
      label: "Import Tomoji",
      description: "Load a .tomoji character folder",
      onSelect: onImportTomoji,
    },
    {
      id: "import-shimeji",
      label: "Import Shimeji",
      description: "Auto-convert a full Shimeji folder",
      onSelect: onImportShimeji,
    },
  ];

  return (
    <div
      role="presentation"
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Add a Tomoji"
        className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-950 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Add a Tomoji</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-xl leading-none text-neutral-400 hover:text-white"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={option.onSelect}
              className="rounded-xl border border-neutral-700 px-4 py-3 text-left transition enabled:hover:border-white enabled:hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <p className="text-sm font-bold text-white">{option.label}</p>
              <p className="text-xs text-neutral-400">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
