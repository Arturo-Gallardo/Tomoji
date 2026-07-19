import { useState } from "react";
import { TomojiPageHeader } from "../dashboard/TomojiPageHeader";
import { TomojiPageLayout } from "../dashboard/TomojiPageLayout";
import {
  importTomojiFromFolder,
  type TomojiImportResult,
} from "../../services/tomojiImporter";

interface TomojiImportScreenProps {
  onClose: () => void;
  onImported: (characterId: string) => void | Promise<void>;
}

export function TomojiImportScreen({
  onClose,
  onImported,
}: TomojiImportScreenProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<TomojiImportResult | null>(null);

  const handleChooseFolder = async () => {
    setIsImporting(true);
    setResult(null);
    try {
      const outcome = await importTomojiFromFolder();
      if (outcome === null) {
        return;
      }

      setResult(outcome);
      if (outcome.ok && outcome.characterId) {
        await onImported(outcome.characterId);
      }
    } catch (error) {
      setResult({
        ok: false,
        errors: [error instanceof Error ? error.message : "import failed"],
        warnings: [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title="Import Tomoji"
          subtitle="Only for Tomoji backups — not downloaded Shimeji packs"
          onBack={onClose}
        />
      }
    >
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <section className="island-card p-5">
          <h2 className="text-base font-extrabold text-island-ink">Choose your extracted Tomoji backup folder</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-island-muted">
            Pick folder containing <strong>manifest.json</strong> and <strong>sprites</strong>. Do not choose a ZIP/RAR, individual files, or a downloaded Shimeji pack. Nothing uploads.
          </p>
          <button
            type="button"
            disabled={isImporting}
            onClick={handleChooseFolder}
            className="island-button island-button--primary mt-5 disabled:opacity-50"
          >
            {isImporting ? "Importing..." : "Choose Tomoji backup folder"}
          </button>
        </section>

        <section className="island-card p-5">
          <h2 className="text-base font-extrabold text-island-ink">Folder contents</h2>
          <pre className="island-form-section mt-3 overflow-x-auto text-xs leading-6 text-island-ink">{`My Tomoji/
├── manifest.json
└── sprites/
    ├── idle.png
    └── walk-1.png`}</pre>
          <p className="mt-3 text-xs font-medium leading-relaxed text-island-muted">
            Keep manifest.json and every referenced sprite in this folder.
          </p>
        </section>
      </div>

      {result ? (
        <div className="mt-8 max-w-xl space-y-3">
          {result.ok ? (
            <p className="rounded-lg border border-island-orange/40 bg-island-orange/10 px-4 py-3 text-sm font-semibold text-island-orange">
              Imported successfully.
            </p>
          ) : null}

          {result.errors.length > 0 ? (
            <ul className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {result.errors.map((error) => (
                <li key={error}>- {error}</li>
              ))}
            </ul>
          ) : null}

          {result.warnings.length > 0 ? (
            <ul className="rounded-lg border border-yellow-600/40 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-200">
              {result.warnings.map((warning) => (
                <li key={warning}>- {warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </TomojiPageLayout>
  );
}
