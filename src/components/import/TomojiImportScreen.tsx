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
        <TomojiPageHeader title="Import Tomoji" onBack={onClose} />
      }
    >
      <p className="mb-8 max-w-xl text-sm font-medium leading-relaxed text-island-muted">
        Select a Tomoji character folder. It must contain a
        <code className="mx-1 rounded bg-island-custard px-1.5 py-0.5 font-semibold text-island-ink">
          manifest.json
        </code>
        and the sprite files it references.
      </p>

      <button
        type="button"
        disabled={isImporting}
        onClick={handleChooseFolder}
        className="island-button island-button--primary disabled:opacity-50"
      >
        {isImporting ? "Importing..." : "Choose folder"}
      </button>

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
