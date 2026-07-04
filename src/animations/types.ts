export interface SpriteAnchor {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface AnimationDefinition {
  frames: string[];
  tickDuration: number;
  // optional per-frame hold lengths in tick units (25ms each)
  frameTickDurations?: number[];
  velocity: Velocity;
}

export type CompanionAction =
  | "idle"
  | "walk"
  | "floorCrawl"
  | "sit"
  | "sitAlt"
  | "sitAlt2"
  | "sitOnBar"
  | "dangleOnBar"
  | "grabWall"
  | "climbWall"
  | "climbWallDown"
  | "grabCeiling"
  | "climbCeiling"
  | "grabbed"
  | "resist"
  | "fall"
  | "bounce"
  | "emote"
  | "emote2"
  | "emote3"
  | "emote4"
  | "emote5"
  | "emote6";

export type FacingDirection = "left" | "right";

// velocity-based lean tier while the pet is being dragged
export type GrabbedLeanTier =
  | "lightLeft"
  | "mildLeft"
  | "strongLeft"
  | "lightRight"
  | "mildRight"
  | "strongRight";
