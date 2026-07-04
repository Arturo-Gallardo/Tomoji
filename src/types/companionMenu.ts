export type CompanionMenuAnimationAction =
  | "sit"
  | "sitAlt"
  | "sitAlt2"
  | "emote"
  | "emote2"
  | "emote3"
  | "emote4"
  | "emote5"
  | "emote6";

export type CompanionMenuAction =
  | "walkTo"
  | "floorCrawlTo"
  | "crawlTo"
  | "climbTo"
  | "turnAround"
  | CompanionMenuAnimationAction
  | "toggleFreeze"
  | "toggleMute"
  | "turnOff";

export type TargetPickerMode = "walk" | "floorCrawl" | "crawl" | "climb";

export interface CompanionMenuActionPayload {
  action: CompanionMenuAction;
}

export interface CompanionMenuConfigPayload {
  wallLocked: boolean;
  undersideLocked: boolean;
  frozen: boolean;
  muted: boolean;
  canFloorCrawl: boolean;
  availableActions: CompanionMenuAnimationAction[];
  targetLabel: string;
}

export interface TargetPickerOpenPayload {
  mode: TargetPickerMode;
  targetLabel: string;
}

export interface TargetPickerSelectedPayload {
  mode: TargetPickerMode;
  anchorX: number;
  anchorY: number;
}
