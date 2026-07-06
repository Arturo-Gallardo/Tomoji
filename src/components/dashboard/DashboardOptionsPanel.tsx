import { emitDialogueStart } from "../../services/companionDialogue";
import { emitFreezeToggle } from "../../services/companionFreeze";
import { emitSitToggle } from "../../services/companionSit";
import { useCompanionMirrorState } from "../../hooks/useCompanionMirrorState";
import {
  hasDialogueLines,
  pickDialogueLine,
} from "../../services/dialogueManager";
import type { CompanionInstance } from "../../types/companionInstance";
import { updateInstance } from "../../services/companionInstanceManager";

const BLOCKED_COMPANION_COMMAND_STATES = new Set([
  "dragging",
  "falling",
  "bouncing",
  "climbing",
]);

function commandHint(
  isCommandBlocked: boolean,
  isMuted: boolean,
  canDialogue: boolean,
): string {
  if (isCommandBlocked) {
    return "Some commands pause while the Tomoji is falling, dragging, or climbing.";
  }

  if (isMuted) {
    return "Muted Tomojis will not speak until unmuted.";
  }

  if (!canDialogue) {
    return "Add dialogue lines in Edit to enable manual speech.";
  }

  return "Use these for quick control without opening the card menu.";
}

interface DashboardOptionsPanelProps {
  instance: CompanionInstance;
}

export function DashboardOptionsPanel({ instance }: DashboardOptionsPanelProps) {
  const mirrorState = useCompanionMirrorState(instance.id);
  const isCommandBlocked = BLOCKED_COMPANION_COMMAND_STATES.has(
    mirrorState.behaviorState,
  );
  const isSitting = mirrorState.behaviorState === "sitting";
  const canToggleSit = isSitting || !isCommandBlocked;
  const isFrozen = mirrorState.isFrozen;
  const isMuted = instance.muted === true;
  const canDialogue =
    hasDialogueLines(instance.dialogueSettings, instance.characterId) &&
    !isMuted &&
    !isCommandBlocked;

  const handleDialogueClick = () => {
    if (!canDialogue) {
      return;
    }

    const line = pickDialogueLine(
      instance.dialogueSettings,
      instance.characterId,
    );
    if (line === null) {
      return;
    }

    void emitDialogueStart(line, instance.id);
  };

  const handleSitClick = () => {
    if (!canToggleSit) {
      return;
    }

    void emitSitToggle(instance.id);
  };

  const handleFreezeClick = () => {
    void emitFreezeToggle(instance.id);
  };

  const handleMuteClick = () => {
    void updateInstance(instance.id, { muted: !isMuted });
  };
  const hint = commandHint(isCommandBlocked, isMuted, canDialogue);

  return (
    <section className="flex h-full min-h-0 items-center justify-center p-8">
      <div className="flex h-full w-full max-w-sm flex-col rounded-lg border-2 border-neutral-600/80 p-6">
        <div className="mb-5">
          <p className="text-sm font-bold text-white">{instance.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{hint}</p>
        </div>

        <div className="flex flex-1 flex-col justify-evenly gap-4">
          <button
            type="button"
            onClick={handleDialogueClick}
            disabled={!canDialogue}
            title={!canDialogue ? hint : "Make this Tomoji say a line now"}
            className="flex flex-1 items-center justify-center rounded-md border-2 border-neutral-600/70 text-lg text-neutral-200 enabled:hover:border-neutral-400/80 enabled:hover:text-white disabled:cursor-default disabled:opacity-50"
          >
            Dialogue
          </button>

          <button
            type="button"
            onClick={handleSitClick}
            disabled={!canToggleSit}
            title={!canToggleSit ? hint : isSitting ? "Stand up" : "Sit down"}
            className={`flex flex-1 items-center justify-center rounded-md border-2 text-lg text-neutral-200 enabled:hover:border-neutral-400/80 enabled:hover:text-white disabled:cursor-default disabled:opacity-50 ${
              isSitting
                ? "border-neutral-400/90 text-white"
                : "border-neutral-600/70"
            }`}
          >
            {isSitting ? "Stand" : "Sit"}
          </button>

          <button
            type="button"
            onClick={handleFreezeClick}
            className={`flex flex-1 items-center justify-center rounded-md border-2 text-lg text-neutral-200 hover:border-neutral-400/80 hover:text-white ${
              isFrozen
                ? "border-neutral-400/90 text-white"
                : "border-neutral-600/70"
            }`}
          >
            {isFrozen ? "Unfreeze" : "Freeze"}
          </button>

          <button
            type="button"
            onClick={handleMuteClick}
            aria-pressed={isMuted}
            className={`flex flex-1 items-center justify-center rounded-md border-2 text-lg text-neutral-200 hover:border-neutral-400/80 hover:text-white ${
              isMuted
                ? "border-neutral-400/90 text-white"
                : "border-neutral-600/70"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>
    </section>
  );
}
