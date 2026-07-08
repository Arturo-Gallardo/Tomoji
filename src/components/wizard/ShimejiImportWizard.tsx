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
            className="flex flex-wrap gap-2"
            aria-label="Create Tomoji steps"
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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 disabled:opacity-40"
          >
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={isFinishing || !hasRequiredFrames}
              className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {isFinishing ? "Creating..." : "Create editable Tomoji"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              disabled={!canProceed}
              className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      }
    >
      {step === 0 ? (
        <SelectImgFolderStep controller={controller} variant="tomoji" />
      ) : null}
      {step === 1 ? <AssignAnimationsStep controller={controller} /> : null}
      {step === 2 ? <CharacterDetailsStep controller={controller} /> : null}
      {step === 3 ? <FinalPreviewStep controller={controller} /> : null}

      {error ? (
        <p className="mt-6 rounded-lg border border-red-600/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </TomojiPageLayout>
  );
}
