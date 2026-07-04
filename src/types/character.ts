import type { Velocity } from "../animations/types";

// a single frame of an animation. src is relative to the character folder root
// for imported characters (e.g. "sprites/walk/0.png" or ".gif") or a resolvable url.
export interface AnimationFrame {
  src: string;
  // editable source-library frame used to regenerate assigned animation files
  source?: string;
  // optional per-frame hold in engine ticks (25ms each); overrides fps when set
  durationTicks?: number;
}

// serializable animation as stored inside a character manifest. the
// AnimationRegistry converts this into the runtime form the engine consumes.
export interface AnimationDefinition {
  frames: AnimationFrame[];
  // playback rate of the loop; converted to engine ticks by the registry
  fps: number;
  // per-tick movement applied while this animation plays (screen px per tick)
  velocity?: Velocity;
}

// fine-grained buckets aligned with the engine's CompanionAction set.
// the registry maps each runtime action onto one of these slots.
export type AnimationCategory =
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
  | "dragLightLeft"
  | "dragMildLeft"
  | "dragStrongLeft"
  | "dragLightRight"
  | "dragMildRight"
  | "dragStrongRight"
  | "dragResist"
  | "grabWall"
  | "climbWall"
  | "grabCeiling"
  | "climbCeiling"
  | "emote"
  | "emote2"
  | "emote3"
  | "emote4"
  | "emote5"
  | "emote6";

export const ANIMATION_CATEGORIES: readonly AnimationCategory[] = [
  "idle",
  "walk",
  "floorCrawl",
  "sit",
  "sitAlt",
  "sitAlt2",
  "sitOnBar",
  "dangleOnBar",
  "fall",
  "bounce",
  "dragLightLeft",
  "dragMildLeft",
  "dragStrongLeft",
  "dragLightRight",
  "dragMildRight",
  "dragStrongRight",
  "dragResist",
  "grabWall",
  "climbWall",
  "grabCeiling",
  "climbCeiling",
  "emote",
  "emote2",
  "emote3",
  "emote4",
  "emote5",
  "emote6",
] as const;

// idle + walk are required for import; everything else falls back at runtime.
export const REQUIRED_ANIMATION_CATEGORIES: readonly AnimationCategory[] = [
  "idle",
  "walk",
] as const;

const REQUIRED_ANIMATION_SET = new Set<AnimationCategory>(
  REQUIRED_ANIMATION_CATEGORIES,
);

export function isRequiredAnimationCategory(
  category: AnimationCategory,
): boolean {
  return REQUIRED_ANIMATION_SET.has(category);
}

export function hasRequiredAnimationAssignments(
  assignments: Partial<
    Record<AnimationCategory, { frames: readonly unknown[] }>
  >,
): boolean {
  return REQUIRED_ANIMATION_CATEGORIES.every(
    (category) => (assignments[category]?.frames.length ?? 0) > 0,
  );
}

export type RandomSitAction = "sit" | "sitAlt" | "sitAlt2";

export interface BehaviorSettings {
  // multiplier applied to the character base walk velocity
  movementSpeed: number;
  // 0..1 likelihood the companion starts an autonomous action when idle
  actionFrequency: number;
  // 0..1 likelihood the companion speaks on its own
  dialogueFrequency: number;
  allowRandomWalk: boolean;
  walkFrequency: number;
  allowRandomFloorCrawl: boolean;
  floorCrawlFrequency: number;
  allowRandomSit: boolean;
  sitFrequency: number;
  randomSitActions: RandomSitAction[];
  allowRandomWallClimb: boolean;
  wallClimbFrequency: number;
  allowRandomCeilingCrawl: boolean;
  ceilingCrawlFrequency: number;
  allowRandomDialogue: boolean;
}

export interface DialogueSettings {
  lines: string[];
  // 0..1 likelihood a line is shown when a dialogue tick fires
  frequency: number;
}

export type AnimationPlaybackStyle = "shimeji" | "sequential";

export interface CharacterManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  defaultScale: number;
  // base walk speed in screen px per tick (25ms cadence)
  defaultSpeed: number;
  frameWidth: number;
  frameHeight: number;
  animations: Partial<Record<AnimationCategory, AnimationDefinition>>;
  behaviorSettings: BehaviorSettings;
  dialogueSettings: DialogueSettings;
  // shimeji = classic walk/climb index cycle; sequential = 1→2→… loop
  playbackStyle?: AnimationPlaybackStyle;
  // bumped when the on-disk layout changes so older installs can migrate
  storageVersion?: number;
}

export type CharacterSource = "builtin" | "tomoji" | "shimeji";

// a registered character in the local library. folderPath is the appData
// directory holding the manifest + sprites for imported characters.
export interface CharacterLibraryEntry {
  manifest: CharacterManifest;
  source: CharacterSource;
  folderPath?: string;
}
