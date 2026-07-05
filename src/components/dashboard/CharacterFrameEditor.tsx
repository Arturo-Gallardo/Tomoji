import { useEffect, useState } from "react";
import { useShimejiDraft } from "../../hooks/useShimejiDraft";
import { getCharacter } from "../../services/characterLibrary";
import { saveCharacterDraft } from "../../services/shimejiImporter";
import { hasRequiredAnimationAssignments } from "../../types/character";
import { AssignAnimationsStep } from "../wizard/AssignAnimationsStep";
import { FinalPreviewStep } from "../wizard/FinalPreviewStep";
import { ShimejiGraphEditor } from "./ShimejiGraphEditor";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";

interface CharacterFrameEditorProps {
  characterId: string;
  characterName: string;
  onClose: () => void;
  onSaved: () => void;
}

const STEP_TITLES = ["Assign animations", "Preview"] as const;

export function CharacterFrameEditor({
  characterId,
  characterName,
  onClose,
  onSaved,
}: CharacterFrameEditorProps) {
  const controller = useShimejiDraft();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isGraphImport, setIsGraphImport] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { draft, isLoadingFolder, loadFromCharacter, mergeImgFolder } =
    controller;
  const hasRequiredFrames = hasRequiredAnimationAssignments(draft.assignments);
  const isLastStep = step === STEP_TITLES.length - 1;

  useEffect(() => {
    let cancelled = false;

    void getCharacter(characterId)
      .then(async (entry) => {
        if (cancelled) {
          return;
        }

        if (entry?.manifest.animationSystem === "shimejiGraph") {
          setIsGraphImport(true);
          return;
        }

        setIsGraphImport(false);
        await loadFromCharacter(characterId);
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error ? caught.message : "failed to load frames",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characterId, loadFromCharacter]);

  if (isGraphImport) {
    return (
      <ShimejiGraphEditor
        characterId={characterId}
        characterName={characterName}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveCharacterDraft(characterId, draft);
      onSaved();
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : "failed to save frames",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Edit frames — ${characterName}`}
            onBack={onClose}
          />
        }
      >
        <p className="rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </p>
      </TomojiPageLayout>
    );
  }

  if ((isGraphImport === null || isLoadingFolder) && draft.sources.length === 0) {
    return (
      <TomojiPageLayout
        header={
          <TomojiPageHeader
            title={`Edit frames — ${characterName}`}
            onBack={onClose}
          />
        }
      >
        <p className="text-sm text-neutral-400">Loading character frames...</p>
      </TomojiPageLayout>
    );
  }

  return (
    <TomojiPageLayout
      wide={step === 0}
      header={
        <div className="space-y-4">
          <TomojiPageHeader
            title={`Edit frames — ${characterName}`}
            onBack={onClose}
          />
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Frame edit steps"
          >
            {STEP_TITLES.map((title, index) => (
              <span
                key={title}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  index === step
                    ? "bg-white text-black"
                    : index < step
                      ? "text-neutral-200"
                      : "text-neutral-500"
                }`}
              >
                {index + 1}. {title}
              </span>
            ))}
          </nav>
        </div>
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 disabled:opacity-40"
          >
            Back
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {step === 0 ? (
              <p className="text-xs text-neutral-500">
                Toggle the Tomoji off and on to refresh on-screen sprites.
              </p>
            ) : null}

            {isLastStep ? (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !hasRequiredFrames}
                className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save frames"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                disabled={!hasRequiredFrames}
                className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                Next
              </button>
            )}
          </div>
        </div>
      }
    >
      {step === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-neutral-400">
              Reassign animation frames from this character&apos;s sprites. Add
              more source PNGs from a Shimeji img folder if you need extra
              frames.
            </p>
            <button
              type="button"
              disabled={isLoadingFolder}
              onClick={() => void mergeImgFolder()}
              className="shrink-0 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-200 hover:border-white disabled:opacity-50"
            >
              {isLoadingFolder ? "Loading..." : "Add frames from folder"}
            </button>
          </div>

          <AssignAnimationsStep controller={controller} />
        </div>
      ) : null}

      {step === 1 ? <FinalPreviewStep controller={controller} /> : null}

      {saveError ? (
        <p className="mt-6 rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {saveError}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
