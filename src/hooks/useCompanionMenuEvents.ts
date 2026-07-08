import { useEffect } from "react";
import { listenCompanionMenuAction } from "../services/companionMenuApi";
import { showTargetPicker } from "../services/companionWalkPickerApi";
import type { CompanionMenuAction } from "../types/companionMenu";
import type { CompanionMenuAnimationAction } from "../types/companionMenu";

interface UseCompanionMenuEventsOptions {
  onTurnAround: () => void;
  onPlayAnimation: (action: CompanionMenuAnimationAction) => void;
  onToggleFreeze: () => void;
  onToggleMute: () => void;
  onDuplicate: () => void;
  onTurnOff: () => void;
  onUnfreeze: () => void;
}

function handleMenuAction(
  action: CompanionMenuAction,
  handlers: UseCompanionMenuEventsOptions,
): void {
  switch (action) {
    case "walkTo":
      handlers.onUnfreeze();
      void showTargetPicker("walk");
      break;
    case "floorCrawlTo":
      handlers.onUnfreeze();
      void showTargetPicker("floorCrawl");
      break;
    case "crawlTo":
      handlers.onUnfreeze();
      void showTargetPicker("crawl");
      break;
    case "climbTo":
      handlers.onUnfreeze();
      void showTargetPicker("climb");
      break;
    case "turnAround":
      handlers.onTurnAround();
      break;
    case "sit":
    case "sitAlt":
    case "sitAlt2":
    case "sitOnBar":
    case "dangleOnBar":
    case "emote":
    case "emote2":
    case "emote3":
    case "emote4":
    case "emote5":
    case "emote6":
      handlers.onPlayAnimation(action);
      break;
    case "toggleFreeze":
      handlers.onToggleFreeze();
      break;
    case "toggleMute":
      handlers.onToggleMute();
      break;
    case "duplicate":
      handlers.onDuplicate();
      break;
    case "turnOff":
      handlers.onTurnOff();
      break;
    default:
      break;
  }
}

export function useCompanionMenuEvents(
  handlers: UseCompanionMenuEventsOptions,
): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenCompanionMenuAction((payload) => {
      handleMenuAction(payload.action, handlers);
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
    };
  }, [
    handlers.onPlayAnimation,
    handlers.onToggleFreeze,
    handlers.onToggleMute,
    handlers.onDuplicate,
    handlers.onTurnOff,
    handlers.onTurnAround,
    handlers.onUnfreeze,
  ]);
}
