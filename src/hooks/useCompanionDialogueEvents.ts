import { useEffect } from "react";
import {
  listenDialogueDismiss,
  listenDialogueStart,
} from "../services/companionDialogue";

interface UseCompanionDialogueEventsOptions {
  instanceId?: string;
  startDialogue: (text: string) => void;
  dismissDialogue: () => void;
}

// listens for dashboard dialogue commands in the companion window
export function useCompanionDialogueEvents({
  startDialogue,
  dismissDialogue,
}: UseCompanionDialogueEventsOptions): void {
  useEffect(() => {
    let unlistenStart: (() => void) | undefined;
    let unlistenDismiss: (() => void) | undefined;

    void listenDialogueStart(({ text }) => {
      startDialogue(text);
    }).then((cleanup) => {
      unlistenStart = cleanup;
    });

    void listenDialogueDismiss(() => {
      dismissDialogue();
    }).then((cleanup) => {
      unlistenDismiss = cleanup;
    });

    return () => {
      unlistenStart?.();
      unlistenDismiss?.();
    };
  }, [dismissDialogue, startDialogue]);
}
