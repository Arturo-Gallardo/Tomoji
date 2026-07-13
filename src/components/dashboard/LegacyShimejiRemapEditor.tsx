import { useEffect, useState } from "react";
import { ANIMATION_CATEGORY_META } from "../../constants/animationCategories";
import {
  loadLegacyShimejiRemapData,
  saveLegacyShimejiRemapData,
  type LegacyShimejiRemapData,
} from "../../services/legacyShimejiRemap";
import {
  ANIMATION_CATEGORIES,
  isRequiredAnimationCategory,
  type AnimationCategory,
} from "../../types/character";
import { AnimationPreviewPlayer } from "../preview/AnimationPreviewPlayer";
import { RequiredAnimationBadge } from "../wizard/AnimationCategoryBadge";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";

interface LegacyShimejiRemapEditorProps {
  characterId: string;
  characterName: string;
  onClose: () => void;
  onSaved: () => void;
}

const PREVIEW_SIZE = 72;

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "failed";
}

function optionLabel(category: AnimationCategory): string {
  return ANIMATION_CATEGORY_META[category].label;
}

export function LegacyShimejiRemapEditor({
  characterId,
  characterName,
  onClose,
  onSaved,
}: LegacyShimejiRemapEditorProps) {
  const [data, setData] = useState<LegacyShimejiRemapData | null>(null);
  const [mappings, setMappings] = useState<
    Partial<Record<AnimationCategory, AnimationCategory>>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadLegacyShimejiRemapData(characterId)
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        setData(nextData);
        setMappings(nextData.mappings);
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(errorMessage(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const hasUnsavedChanges =
    data !== null && JSON.stringify(mappings) !== JSON.stringify(data.mappings);
  const hasRequiredMappings = ANIMATION_CATEGORIES.every((category) => {
    if (!isRequiredAnimationCategory(category)) {
      return true;
    }

    return mappings[category] !== undefined;
  });

  const handleClose = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved Shimeji action mappings?")
    ) {
      return;
    }

    onClose();
  };

  const setMapping = (target: AnimationCategory, source: string) => {
    setMappings((current) => {
      const next = { ...current };
      if (source === "") {
        delete next[target];
        return next;
      }

      next[target] = source as AnimationCategory;
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveLegacyShimejiRemapData(characterId, mappings);
      onSaved();
    } catch (caught) {
      setSaveError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Remap Shimeji actions - ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <p className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </p>
      </TomojiPageLayout>
    );
  }

  if (!data) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Remap Shimeji actions - ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <p className="text-sm text-neutral-400">Loading Shimeji actions...</p>
      </TomojiPageLayout>
    );
  }

  return (
    <TomojiPageLayout
      wide
      header={
        <TomojiPageHeader
          title={`Remap Shimeji actions - ${characterName}`}
          subtitle="Choose which preserved Shimeji action powers each Tomoji behavior. Sprites, frame order, and timing stay locked."
          onBack={handleClose}
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isSaving || !hasRequiredMappings}
            onClick={() => void handleSave()}
            className="island-button island-button--action text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save mappings"}
          </button>
        </div>
      }
    >
      <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-bold text-amber-100">Shimeji import rules</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
          This character keeps its imported Shimeji sprites intact. You can
          point Tomoji behaviors at those imported actions, but you cannot edit
          individual sprites, frame order, or add outside frames here.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ANIMATION_CATEGORIES.map((category) => {
          const mappedCategory = mappings[category];
          const previewFrames = mappedCategory
            ? data.previewUrlsByCategory[mappedCategory] ?? []
            : [];

          return (
            <section
              key={category}
              className="min-w-0 rounded-2xl border border-neutral-800 bg-neutral-900/45 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/80">
                  <AnimationPreviewPlayer
                    frames={previewFrames}
                    fps={data.fpsByCategory[mappedCategory ?? category] ?? 8}
                    width={PREVIEW_SIZE}
                    height={PREVIEW_SIZE}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-white">
                      {optionLabel(category)}
                    </p>
                    <RequiredAnimationBadge category={category} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                    {ANIMATION_CATEGORY_META[category].description}
                  </p>
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Imported action
                </span>
                <select
                  value={mappedCategory ?? ""}
                  onChange={(event) => setMapping(category, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-white"
                >
                  {!isRequiredAnimationCategory(category) ? (
                    <option value="">None</option>
                  ) : null}
                  {data.sourceCategories.map((sourceCategory) => (
                    <option key={sourceCategory} value={sourceCategory}>
                      {optionLabel(sourceCategory)}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          );
        })}
      </div>

      {saveError ? (
        <p className="mt-6 rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {saveError}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
