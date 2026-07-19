import { useState } from "react";
import { TomojiPageHeader } from "../dashboard/TomojiPageHeader";
import { TomojiPageLayout } from "../dashboard/TomojiPageLayout";
import { AnimationPreviewPlayer } from "../preview/AnimationPreviewPlayer";
import { ANIMATION_CATEGORY_META } from "../../constants/animationCategories";
import {
  importScannedTomoji,
  pickTomojiImportFolder,
  scanTomojiImportFolder,
  type TomojiImportResult,
  type TomojiImportScan,
} from "../../services/tomojiImporter";
import { toAssetUrl } from "../../services/fs/fileSystemAdapter";
import type { AnimationCategory } from "../../types/character";

interface TomojiImportScreenProps {
  onClose: () => void;
  onImported: (characterId: string) => void | Promise<void>;
}

function TomojiAnimationPreview({ scan }: { scan: TomojiImportScan }) {
  const categories = (Object.keys(scan.animationFramePaths) as AnimationCategory[])
    .filter((category) => (scan.animationFramePaths[category]?.length ?? 0) > 0);
  const [activeCategory, setActiveCategory] = useState<AnimationCategory>(
    categories[0] ?? "idle",
  );
  const frames = scan.animationFramePaths[activeCategory] ?? [];
  const definition = scan.manifest.animations[activeCategory];

  if (categories.length === 0 || !definition) {
    return null;
  }

  return (
    <section className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.3fr)]">
      <div className="island-form-section min-w-0 p-3">
        <p className="px-1 pb-2 text-sm font-extrabold text-island-ink">Animation browser</p>
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-lg border-2 px-3 py-2 text-left text-sm font-extrabold transition ${
                  isActive
                    ? "border-island-ink bg-island-custard text-island-ink"
                    : "border-island-ink/15 bg-white/70 text-island-muted hover:border-island-ink/40"
                }`}
              >
                {ANIMATION_CATEGORY_META[category].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="island-form-section min-w-0 p-4">
        <p className="text-sm font-extrabold text-island-ink">
          {ANIMATION_CATEGORY_META[activeCategory].label}
        </p>
        <p className="mt-1 text-xs text-island-muted">
          {frames.length} frame{frames.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 grid min-h-72 place-items-center rounded-xl border-2 border-island-ink/15 bg-island-custard/25 p-4">
          <AnimationPreviewPlayer
            frames={frames.map((path) => toAssetUrl(path))}
            fps={definition.fps}
            width={280}
            height={280}
          />
        </div>
      </div>
    </section>
  );
}

export function TomojiImportScreen({
  onClose,
  onImported,
}: TomojiImportScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scan, setScan] = useState<TomojiImportScan | null>(null);
  const [name, setName] = useState("");
  const [isReviewStep, setIsReviewStep] = useState(false);
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const [result, setResult] = useState<TomojiImportResult | null>(null);

  const handleChooseFolder = async () => {
    const sourceDir = await pickTomojiImportFolder();
    if (sourceDir === null) {
      return;
    }

    setIsScanning(true);
    setResult(null);
    setScan(null);
    setIsReviewStep(false);
    setShowScanSuccess(false);
    try {
      const outcome = await scanTomojiImportFolder(sourceDir);
      if ("errors" in outcome) {
        setResult(outcome);
        return;
      }

      setScan(outcome);
      setName(outcome.manifest.name);
      setShowScanSuccess(true);
    } catch (error) {
      setResult({
        ok: false,
        errors: [error instanceof Error ? error.message : "scan failed"],
        warnings: [],
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async () => {
    if (scan === null || isImporting) {
      return;
    }

    setIsImporting(true);
    setResult(null);
    try {
      const outcome = await importScannedTomoji(scan, name);
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

  const goToReview = () => {
    setShowScanSuccess(false);
    setIsReviewStep(true);
  };

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title={isReviewStep ? "Name and preview" : "Import Tomoji"}
          subtitle={isReviewStep ? "Name your Tomoji, check its preview, then import." : "Import any Tomoji character folder — not downloaded Shimeji packs"}
          onBack={isReviewStep ? () => setIsReviewStep(false) : onClose}
          backLabel={isReviewStep ? "Back" : undefined}
          trailing={
            scan && !isReviewStep ? (
              <button type="button" onClick={goToReview} className="island-button island-button--soft bg-white text-sm">
                Continue to preview
              </button>
            ) : undefined
          }
        />
      }
    >
      {isReviewStep && scan ? (
        <div className="island-card mx-auto max-w-5xl p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-full max-w-sm text-sm font-extrabold text-island-ink">
              Tomoji name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="island-input mt-2 px-3 py-2 text-sm"
                placeholder={scan.manifest.name}
              />
            </label>
            <button
              type="button"
              disabled={isImporting || name.trim() === ""}
              onClick={() => void handleImport()}
              className="island-button island-button--primary disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Import as Tomoji"}
            </button>
          </div>
          <p className="mt-2 text-sm text-island-muted">
            Check the preview, then import when it looks right.
          </p>
          <TomojiAnimationPreview key={scan.sourceDir} scan={scan} />
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <section className="island-card flex flex-col p-6">
            <h2 className="text-base font-extrabold text-island-ink">Choose a Tomoji character folder</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-island-muted">
              Pick folder containing <strong>manifest.json</strong> and <strong>sprites</strong>. It can be yours or one shared by someone else. Do not choose a ZIP/RAR, individual files, or a downloaded Shimeji pack. Nothing uploads.
            </p>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => void handleChooseFolder()}
              className="island-button island-button--primary mt-5 disabled:opacity-50"
            >
              {isScanning ? "Scanning..." : "Choose Tomoji character folder"}
            </button>
          </section>

          <section className="island-card p-6">
            <h2 className="text-base font-extrabold text-island-ink">Folder contents</h2>
            <pre className="island-form-section mt-3 overflow-x-auto text-xs leading-6 text-island-ink">{`My Tomoji/
├── manifest.json
└── sprites/
    ├── idle.png
    └── walk-1.png`}</pre>
          </section>
        </div>
      )}

      {result && result.errors.length > 0 ? (
        <ul className="mt-8 max-w-xl rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {result.errors.map((error) => <li key={error}>- {error}</li>)}
        </ul>
      ) : null}

      {showScanSuccess && scan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-island-ink/25 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="tomoji-scan-success" className="island-dialog w-full max-w-sm p-6 text-center">
            <p id="tomoji-scan-success" className="text-lg font-extrabold text-island-ink">Scan successful</p>
            <p className="mt-2 text-sm leading-relaxed text-island-muted">Your Tomoji is ready to preview and name.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={goToReview} className="island-button island-button--primary">Continue to preview</button>
              <button type="button" onClick={() => setShowScanSuccess(false)} className="island-button island-button--soft">Stay here</button>
            </div>
          </div>
        </div>
      ) : null}
    </TomojiPageLayout>
  );
}
