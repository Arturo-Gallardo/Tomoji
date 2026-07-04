import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { pickDialogueLine } from "../services/dialogueManager";
import type { DialogueSettings } from "../types/character";
import type { CompanionBehaviorState } from "../types/companion";

const MIN_AUTONOMOUS_DIALOGUE_MS = 20000;
const MAX_AUTONOMOUS_DIALOGUE_MS = 50000;
const DEFAULT_AUTONOMOUS_DIALOGUE_CHANCE = 0.2;

const ELIGIBLE_STATES: ReadonlySet<CompanionBehaviorState> = new Set([
  "idle",
  "walking",
  "sitting",
]);

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function isAutonomousDialogueEligible(state: CompanionBehaviorState): boolean {
  return ELIGIBLE_STATES.has(state);
}

interface UseAutonomousDialogueOptions {
  isEnabled: boolean;
  isReady: boolean;
  isFrozen: boolean;
  isFrozenRef: RefObject<boolean>;
  behaviorState: CompanionBehaviorState;
  behaviorStateRef: RefObject<CompanionBehaviorState>;
  startDialogue: (text: string) => void;
  characterId: string;
  isMuted: boolean;
  frequency?: number;
  // the speaking companion's lines + how chatty it is (0..1)
  dialogueSettings?: DialogueSettings;
}

export function useAutonomousDialogue({
  isEnabled,
  isReady,
  isFrozen,
  isFrozenRef,
  behaviorState,
  behaviorStateRef,
  startDialogue,
  characterId,
  isMuted,
  frequency,
  dialogueSettings,
}: UseAutonomousDialogueOptions): void {
  const startDialogueRef = useRef(startDialogue);
  const characterIdRef = useRef(characterId);
  const dialogueSettingsRef = useRef(dialogueSettings);
  const frequencyRef = useRef(frequency);

  useEffect(() => {
    startDialogueRef.current = startDialogue;
    characterIdRef.current = characterId;
    dialogueSettingsRef.current = dialogueSettings;
    frequencyRef.current = frequency;
  }, [characterId, dialogueSettings, frequency, startDialogue]);

  useEffect(() => {
    if (
      !isReady ||
      !isEnabled ||
      isFrozen ||
      isMuted ||
      !isAutonomousDialogueEligible(behaviorState)
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(
        () => {
          if (cancelled || isFrozenRef.current) {
            return;
          }

          const currentState = behaviorStateRef.current;
          if (
            currentState === undefined ||
            !isAutonomousDialogueEligible(currentState)
          ) {
            return;
          }

          const settings = dialogueSettingsRef.current;
          const chance =
            frequencyRef.current ??
            settings?.frequency ??
            DEFAULT_AUTONOMOUS_DIALOGUE_CHANCE;

          if (Math.random() < chance) {
            const line = pickDialogueLine(
              settings ?? { lines: [], frequency: chance },
              characterIdRef.current,
            );
            if (line !== null) {
              startDialogueRef.current(line);
            }
          }

          scheduleNext();
        },
        randomBetween(MIN_AUTONOMOUS_DIALOGUE_MS, MAX_AUTONOMOUS_DIALOGUE_MS),
      );
    };

    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    behaviorState,
    behaviorStateRef,
    isEnabled,
    isFrozen,
    isFrozenRef,
    isMuted,
    isReady,
  ]);
}
