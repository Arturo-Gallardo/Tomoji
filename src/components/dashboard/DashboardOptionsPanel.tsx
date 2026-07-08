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
    <section className="flex min-h-0 items-center justify-center">
      <div className="w-full rounded-3xl border border-neutral-700/80 bg-neutral-900/45 p-5 shadow-2xl shadow-black/25">
        <div className="mb-5 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">
            Quick controls
          </p>
          <p className="mt-2 text-lg font-bold text-white">{instance.name}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleDialogueClick}
            title={!canDialogue ? hint : "Make this Tomoji say a line now"}
            aria-disabled={!canDialogue}
            className={`flex min-h-24 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-950/50 text-base font-bold text-neutral-300 transition hover:border-neutral-400/80 hover:text-white ${
              canDialogue ? "" : "cursor-default opacity-45"
            }`}
          >
            Dialogue
          </button>

          <button
            type="button"
            onClick={handleSitClick}
            title={!canToggleSit ? hint : isSitting ? "Stand up" : "Sit down"}
            aria-disabled={!canToggleSit}
            className={`flex min-h-24 items-center justify-center rounded-2xl border text-base font-bold text-neutral-300 transition hover:border-neutral-400/80 hover:text-white ${
              isSitting
                ? "border-white bg-white text-black"
                : "border-neutral-700 bg-neutral-950/50"
            } ${canToggleSit ? "" : "cursor-default opacity-45"}`}
          >
            {isSitting ? "Stand" : "Sit"}
          </button>

          <button
            type="button"
            onClick={handleFreezeClick}
            className={`flex min-h-24 items-center justify-center rounded-2xl border text-base font-bold text-neutral-300 transition hover:border-neutral-400/80 hover:text-white ${
              isFrozen
                ? "border-white bg-white text-black"
                : "border-neutral-700 bg-neutral-950/50"
            }`}
          >
            {isFrozen ? "Unfreeze" : "Freeze"}
          </button>

          <button
            type="button"
            onClick={handleMuteClick}
            aria-pressed={isMuted}
            className={`flex min-h-24 items-center justify-center rounded-2xl border text-base font-bold text-neutral-300 transition hover:border-neutral-400/80 hover:text-white ${
              isMuted
                ? "border-white bg-white text-black"
                : "border-neutral-700 bg-neutral-950/50"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>
    </section>
  );
}
