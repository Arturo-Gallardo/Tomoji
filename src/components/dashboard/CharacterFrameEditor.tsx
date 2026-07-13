import { useEffect, useState } from "react";
import { useShimejiDraft } from "../../hooks/useShimejiDraft";
import { getCharacter } from "../../services/characterLibrary";
import { saveCharacterDraft } from "../../services/shimejiImporter";
import {
  hasRequiredAnimationAssignments,
  type CharacterSource,
} from "../../types/character";
import { AssignAnimationsStep } from "../wizard/AssignAnimationsStep";
import { FinalPreviewStep } from "../wizard/FinalPreviewStep";
import { IslandIcon } from "../ui/IslandIcon";
import { LegacyShimejiRemapEditor } from "./LegacyShimejiRemapEditor";
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
  const [characterSource, setCharacterSource] = useState<CharacterSource | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedDraftJson, setSavedDraftJson] = useState<string | null>(null);

  const { draft, isLoadingFolder, loadFromCharacter, mergeImgFolder } =
    controller;
  const hasRequiredFrames = hasRequiredAnimationAssignments(draft.assignments);
  const isLastStep = step === STEP_TITLES.length - 1;
  const draftJson = JSON.stringify(draft);
  const hasUnsavedChanges =
    savedDraftJson !== null && savedDraftJson !== draftJson;

  const handleClose = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved frame changes?")
    ) {
      return;
    }

    onClose();
  };

  useEffect(() => {
    let cancelled = false;

    void getCharacter(characterId)
      .then(async (entry) => {
        if (cancelled) {
          return;
        }

        if (!entry) {
          setLoadError("character not found");
          return;
        }

        setCharacterSource(entry.source);
        if (entry.source === "builtin") {
          setLoadError("Built-in Tomoji frames are locked.");
          return;
        }

        if (
          entry.source === "shimeji" &&
          entry.manifest.animationSystem === "shimejiGraph"
        ) {
          setIsGraphImport(true);
          return;
        }

        setIsGraphImport(false);
        if (entry.source === "tomoji") {
          await loadFromCharacter(characterId);
        }
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

  useEffect(() => {
    if (
      isGraphImport === false &&
      savedDraftJson === null &&
      draft.sources.length > 0
    ) {
      setSavedDraftJson(draftJson);
    }
  }, [draft.sources.length, draftJson, isGraphImport, savedDraftJson]);

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

  if (characterSource === "shimeji") {
    return (
      <LegacyShimejiRemapEditor
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
      setSavedDraftJson(JSON.stringify(draft));
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
            title={`Edit Tomoji frames - ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <p className="island-notice island-notice--error px-4 py-3 text-sm font-semibold">
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
            title={`Edit Tomoji frames - ${characterName}`}
            onBack={handleClose}
          />
        }
      >
        <div className="island-card flex items-center gap-3 px-5 py-4 text-sm font-bold">
          <IslandIcon name="sparkles" className="h-5 w-5 animate-pulse" />
          Loading character frames...
        </div>
      </TomojiPageLayout>
    );
  }

  return (
    <TomojiPageLayout
      wide={step === 0}
      header={
        <div className="space-y-4">
          <TomojiPageHeader
            title={`Edit Tomoji frames - ${characterName}`}
            onBack={handleClose}
          />
          <nav
            className="island-tabs w-fit max-w-full"
            aria-label="Frame edit steps"
          >
            {STEP_TITLES.map((title, index) => (
              <span
                key={title}
                aria-current={index === step ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-black ${
                  index === step
                    ? "border-[var(--color-island-ink)] bg-[var(--color-island-mint)]"
                    : index < step
                      ? "border-transparent bg-[var(--color-island-paper)]"
                      : "border-transparent text-[var(--color-island-muted)]"
                }`}
              >
                {index < step ? (
                  <IslandIcon name="check" className="h-3.5 w-3.5" />
                ) : (
                  <span>{index + 1}.</span>
                )}
                {title}
              </span>
            ))}
          </nav>
        </div>
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="island-button text-sm"
          >
            <IslandIcon name="back" className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {step === 0 ? (
              <p className="max-w-xs text-xs font-semibold text-[var(--color-island-muted)]">
                Toggle the Tomoji off and on to refresh on-screen sprites.
              </p>
            ) : null}

            {isLastStep ? (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !hasRequiredFrames}
                className="island-button island-button--action text-sm"
              >
                <IslandIcon name="check" className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save frames"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                disabled={!hasRequiredFrames}
                className="island-button island-button--action text-sm"
              >
                Next
              </button>
            )}
          </div>
        </div>
      }
    >
      {step === 0 ? (
        <div className="island-page-enter space-y-6">
          <div className="island-notice flex flex-wrap items-center justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-island-ink)] bg-[var(--color-island-custard)]">
                <IslandIcon name="sparkles" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black">Build each little movement</p>
                <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-[var(--color-island-muted)]">
                  Reassign frames from this Tomoji&apos;s sprites, or add PNG, JPG,
                  WebP, or BMP art from another folder.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isLoadingFolder}
              onClick={() =>
                void mergeImgFolder("Select extra Tomoji sprite folder")
              }
              className="island-button island-button--soft shrink-0 text-sm"
            >
              <IslandIcon name="folder" className="h-4 w-4" />
              {isLoadingFolder ? "Loading..." : "Add frames from folder"}
            </button>
          </div>

          <AssignAnimationsStep controller={controller} />
        </div>
      ) : null}

      {step === 1 ? <FinalPreviewStep controller={controller} /> : null}

      {saveError ? (
        <p className="island-notice island-notice--error mt-6 px-4 py-3 text-sm font-semibold">
          {saveError}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
