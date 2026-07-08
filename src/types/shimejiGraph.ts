import type { Velocity } from "../animations/types";

export type ShimejiActionIntent =
  | "idle"
  | "walk"
  | "floorCrawl"
  | "sit"
  | "sitAlt"
  | "sitAlt2"
  | "sitOnBar"
  | "dangleOnBar"
  | "fall"
  | "bounce"
  | "dragged"
  | "dragResist"
  | "grabWall"
  | "climbWall"
  | "grabCeiling"
  | "climbCeiling";

export interface ShimejiPoint {
  x: number;
  y: number;
}

export interface ShimejiGraphPose {
  src: string;
  source?: string;
  durationTicks: number;
  velocity: Velocity;
  imageAnchor: ShimejiPoint;
}

export interface ShimejiActionReference {
  name: string;
  durationTicks?: number;
}

export interface ShimejiGraphAction {
  name: string;
  type: string | null;
  borderType: string | null;
  condition: string | null;
  poses: ShimejiGraphPose[];
  references: ShimejiActionReference[];
}

export interface ShimejiBehaviorReference {
  name: string;
  frequency: number;
  condition: string | null;
}

export interface ShimejiGraphBehavior {
  name: string;
  hidden: boolean;
  frequency: number;
  condition: string | null;
  nextBehaviors: ShimejiBehaviorReference[];
}

export interface ShimejiMenuAction {
  actionName: string;
  label: string;
}

export interface ShimejiImportIssue {
  severity: "info" | "warning";
  message: string;
}

export interface ShimejiImportReport {
  actionsParsed: number;
  behaviorsParsed: number;
  posesParsed: number;
  missingImages: string[];
  unsupportedActions: string[];
  issues: ShimejiImportIssue[];
}

export interface ShimejiAnimationGraph {
  actions: Record<string, ShimejiGraphAction>;
  behaviors: Record<string, ShimejiGraphBehavior>;
  defaultActions: Partial<Record<ShimejiActionIntent, string>>;
  menuActions: ShimejiMenuAction[];
  // internal multiplier for oversized source canvases. user-facing scale stays
  // relative to this so 1x remains the sane default size.
  baseDisplayScale?: number;
  spriteCanvas: {
    width: number;
    height: number;
    anchor: ShimejiPoint;
  };
  importReport: ShimejiImportReport;
}
