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
import { IslandIcon, type IslandIconName } from "../ui/IslandIcon";

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

interface QuickActionProps {
  accentClass: string;
  disabled?: boolean;
  icon: IslandIconName;
  label: string;
  pressed?: boolean;
  title: string;
  onClick: () => void;
}

function QuickAction({
  accentClass,
  disabled = false,
  icon,
  label,
  pressed,
  title,
  onClick,
}: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-disabled={disabled}
      aria-pressed={pressed}
      className={`island-action-tile ${accentClass} ${disabled ? "opacity-75" : ""}`}
    >
        <span className="flex items-start">
          <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-island-ink/25 bg-island-paper/80">
            <IslandIcon name={icon} className="h-5 w-5" />
          </span>
        </span>
      <span className="text-base font-extrabold">{label}</span>
    </button>
  );
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
      <div className="island-card w-full p-5 sm:p-6">
        <div className="mb-5 shrink-0">
          <h2 className="text-xl font-extrabold text-island-ink">Play with {instance.name}</h2>
          <p className="mt-1 text-sm font-medium text-island-muted">
            Actions reach your live desktop companion.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction
            accentClass="enabled:hover:bg-island-sky/35"
            icon="dialogue"
            label="Dialogue"
            onClick={handleDialogueClick}
            title={!canDialogue ? hint : "Make this Tomoji say a line now"}
            disabled={!canDialogue}
          />

          <QuickAction
            accentClass="enabled:hover:bg-island-custard/70"
            icon="sit"
            label={isSitting ? "Stand" : "Sit"}
            onClick={handleSitClick}
            title={!canToggleSit ? hint : isSitting ? "Stand up" : "Sit down"}
            disabled={!canToggleSit}
            pressed={isSitting}
          />

          <QuickAction
            accentClass="enabled:hover:bg-island-sky/25"
            icon="freeze"
            label={isFrozen ? "Unfreeze" : "Freeze"}
            onClick={handleFreezeClick}
            title={isFrozen ? "Resume movement" : "Pause movement"}
            pressed={isFrozen}
          />

          <QuickAction
            accentClass="enabled:hover:bg-island-rose/35"
            icon="mute"
            label={isMuted ? "Unmute" : "Mute"}
            onClick={handleMuteClick}
            title={isMuted ? "Allow dialogue" : "Pause dialogue"}
            pressed={isMuted}
          />
        </div>

      </div>
    </section>
  );
}
