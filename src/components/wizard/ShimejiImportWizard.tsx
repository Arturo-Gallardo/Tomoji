import { useState } from "react";
import { TomojiPageHeader } from "../dashboard/TomojiPageHeader";
import { TomojiPageLayout } from "../dashboard/TomojiPageLayout";
import { useShimejiDraft } from "../../hooks/useShimejiDraft";
import { convertShimejiDraft } from "../../services/shimejiImporter";
import { hasRequiredAnimationAssignments } from "../../types/character";
import { AssignAnimationsStep } from "./AssignAnimationsStep";
import { CharacterDetailsStep } from "./CharacterDetailsStep";
import { FinalPreviewStep } from "./FinalPreviewStep";
import { SelectImgFolderStep } from "./SelectImgFolderStep";
import { IslandIcon } from "../ui/IslandIcon";

interface ShimejiImportWizardProps {
  onClose: () => void;
  onImported: (characterId: string) => void | Promise<void>;
}

const STEP_TITLES = [
  "Select frames",
  "Assign animations",
  "Details",
  "Preview",
] as const;

export function ShimejiImportWizard({
  onClose,
  onImported,
}: ShimejiImportWizardProps) {
  const controller = useShimejiDraft();
  const [step, setStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { draft } = controller;
  const hasSources = draft.imgDir !== null && draft.sources.length > 0;
  const hasRequiredFrames = hasRequiredAnimationAssignments(draft.assignments);

  const canProceed =
    step === 0 ? hasSources : step === 1 ? hasRequiredFrames : true;
  const isLastStep = step === STEP_TITLES.length - 1;

  const handleFinish = async () => {
    setIsFinishing(true);
    setError(null);
    try {
      const characterId = await convertShimejiDraft(draft, { source: "tomoji" });
      await onImported(characterId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "conversion failed");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <TomojiPageLayout
      wide={step === 1}
      header={
        <div className="space-y-4">
          <TomojiPageHeader
            title="Create new Tomoji"
            onBack={onClose}
            backLabel="Cancel"
          />
          <nav
            className="island-segmented w-full"
            aria-label="Create Tomoji steps"
          >
            <ol className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              {STEP_TITLES.map((title, index) => {
                const isCurrent = index === step;
                const isComplete = index < step;

                return (
                  <li
                    key={title}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`island-surface flex min-w-0 items-center gap-2 px-3 py-2 text-xs font-extrabold ${
                      isCurrent
                        ? "border-[var(--color-island-ink)] bg-[var(--color-island-custard)]"
                        : isComplete
                          ? "bg-[var(--color-island-mint)]"
                          : "bg-white/60 text-[color:var(--color-island-ink-muted)]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-island-ink)] ${
                        isCurrent
                          ? "bg-[var(--color-island-orange)] text-white"
                          : isComplete
                            ? "bg-white"
                            : "bg-[var(--color-island-cream)]"
                      }`}
                    >
                      {isComplete ? (
                        <IslandIcon name="check" className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0 leading-tight">{title}</span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="island-button island-button--soft"
          >
            <IslandIcon name="back" className="h-4 w-4" />
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={isFinishing || !hasRequiredFrames}
              className="island-button island-button--action min-w-[12rem]"
            >
              <IslandIcon name="check" className="h-5 w-5" />
              {isFinishing ? "Creating..." : "Create editable Tomoji"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              disabled={!canProceed}
              className="island-button island-button--action min-w-28"
            >
              Next
            </button>
          )}
        </div>
      }
    >
      <div key={step} className="island-page-enter">
        {step === 0 ? (
          <SelectImgFolderStep controller={controller} variant="tomoji" />
        ) : null}
        {step === 1 ? <AssignAnimationsStep controller={controller} /> : null}
        {step === 2 ? <CharacterDetailsStep controller={controller} /> : null}
        {step === 3 ? <FinalPreviewStep controller={controller} /> : null}
      </div>

      {error ? (
        <p
          className="island-notice island-notice--error mt-6 px-4 py-3 text-sm font-semibold"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
