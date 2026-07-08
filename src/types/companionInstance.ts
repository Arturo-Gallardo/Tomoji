import type { CompanionAction } from "../animations/types";
import type { BehaviorSettings, DialogueSettings } from "./character";
import type { CompanionBehaviorState, ScreenPosition } from "./companion";

export interface CompanionVelocity {
  x: number;
  y: number;
}

// a live companion on screen. one CompanionInstance maps to one OS window
// labelled companion-<id>. behavior/dialogue settings start from the
// character defaults and can be overridden per instance.
export interface CompanionInstance {
  id: string;
  name: string;
  characterId: string;
  position: ScreenPosition;
  velocity: CompanionVelocity;
  scale: number;
  enabled: boolean;
  muted?: boolean;
  // hidden from main tomojis grid; companion window stays closed
  archived?: boolean;
  // live-only context-menu clone; hidden from Tomojis and dropped on reconcile
  isTemporaryClone?: boolean;
  parentInstanceId?: string;
  currentAnimation: CompanionAction;
  behaviorState: CompanionBehaviorState;
  behaviorSettings: BehaviorSettings;
  dialogueSettings: DialogueSettings;
}
