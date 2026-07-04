import type { AnimationCategory } from "../types/character";

export type AnimationCategoryGroupId =
  | "ground"
  | "sit"
  | "air"
  | "drag"
  | "wall"
  | "ceiling"
  | "emotes";

export interface AnimationCategoryMeta {
  id: AnimationCategory;
  label: string;
  description: string;
  group: AnimationCategoryGroupId;
}

export interface AnimationCategoryGroup {
  id: AnimationCategoryGroupId;
  label: string;
  categories: AnimationCategory[];
}

export const ANIMATION_CATEGORY_META: Record<
  AnimationCategory,
  AnimationCategoryMeta
> = {
  idle: {
    id: "idle",
    label: "Idle",
    description:
      "Standing still on the floor. Usually one frame held still; if you assign multiple, they loop in order (1→2→3→1…).",
    group: "ground",
  },
  walk: {
    id: "walk",
    label: "Walk",
    description:
      "Recommended: three frames (stand, step, alt step). Imported characters loop frames in assignment order (1→2→3→1…). The built-in pet uses the classic shimeji 2→1→3→1 cycle.",
    group: "ground",
  },
  floorCrawl: {
    id: "floorCrawl",
    label: "Floor crawl",
    description:
      "Low crawl/creep along the floor. Shimeji Creep imports here automatically. Frames loop while the Tomoji moves sideways.",
    group: "ground",
  },
  sit: {
    id: "sit",
    label: "Sit — floor (primary)",
    description:
      "Main sitting pose on the floor or taskbar. One frame stays still; multiple frames loop in order. The engine randomly picks among all assigned floor sit slots.",
    group: "sit",
  },
  sitAlt: {
    id: "sitAlt",
    label: "Sit — floor (alt 1)",
    description:
      "Optional second floor sit pose. Same playback as primary sit — still hold or 1→2→… loop. Mixed in randomly with other floor sits.",
    group: "sit",
  },
  sitAlt2: {
    id: "sitAlt2",
    label: "Sit — floor (alt 2)",
    description:
      "Optional third floor sit pose. Same playback as primary sit — still hold or 1→2→… loop. Mixed in randomly with other floor sits.",
    group: "sit",
  },
  sitOnBar: {
    id: "sitOnBar",
    label: "Sit — window top (still)",
    description:
      "Static perch on a window title bar. One frame held still the whole time; extra frames loop in order if assigned. Used when no dangle loop is set.",
    group: "sit",
  },
  dangleOnBar: {
    id: "dangleOnBar",
    label: "Sit — window top (dangle)",
    description:
      "Leg-dangle on a title bar. Frames loop in order (1→2→3→1…) — e.g. legs swing out and back. Preferred over the still bar sit when assigned.",
    group: "sit",
  },
  fall: {
    id: "fall",
    label: "Fall",
    description:
      "Dropping through the air. One frame held still for the whole fall; if you assign several, only the first is used.",
    group: "air",
  },
  bounce: {
    id: "bounce",
    label: "Land / get up",
    description:
      "Landing after a fall or throw. Plays once through your frames in order (1→2→3…) — squish, then stand — then returns to idle. Does not loop.",
    group: "air",
  },
  dragLightLeft: {
    id: "dragLightLeft",
    label: "Drag — light right",
    description:
      "Light lean while dragged slowly right. One still frame (or the first frame if you assign several). Shown when sideways movement is gentle.",
    group: "drag",
  },
  dragMildLeft: {
    id: "dragMildLeft",
    label: "Drag — mild right",
    description:
      "Medium lean dragged right. One still frame held while movement is moderate — between light and strong.",
    group: "drag",
  },
  dragStrongLeft: {
    id: "dragStrongLeft",
    label: "Drag — strong right",
    description:
      "Strong lean dragged or flung right. One still frame held while moving quickly to the right.",
    group: "drag",
  },
  dragLightRight: {
    id: "dragLightRight",
    label: "Drag — light left",
    description:
      "Light lean while dragged slowly left. One still frame (or the first if several). Shown when sideways movement is gentle.",
    group: "drag",
  },
  dragMildRight: {
    id: "dragMildRight",
    label: "Drag — mild left",
    description:
      "Medium lean dragged left. One still frame held while movement is moderate — between light and strong.",
    group: "drag",
  },
  dragStrongRight: {
    id: "dragStrongRight",
    label: "Drag — strong left",
    description:
      "Strong lean dragged or flung left. One still frame held while moving quickly to the left.",
    group: "drag",
  },
  dragResist: {
    id: "dragResist",
    label: "Drag — resist",
    description:
      "Brief struggle right after pickup (~0.2s). Frames loop in order (1→2→1→2…) during that window, then normal drag lean takes over.",
    group: "drag",
  },
  grabWall: {
    id: "grabWall",
    label: "Wall cling",
    description:
      "Stuck to a vertical window edge, not moving. One frame held still; extras loop in order if assigned.",
    group: "wall",
  },
  climbWall: {
    id: "climbWall",
    label: "Wall climb",
    description:
      "Recommended: three frames (same rhythm as walk). Built-in pet plays 2→1→3→1 while climbing; climbing down starts at frame 2. Imported characters loop frames in assignment order.",
    group: "wall",
  },
  grabCeiling: {
    id: "grabCeiling",
    label: "Ceiling cling",
    description:
      "Hanging under a window edge, not crawling. One frame held still; extras loop in order if assigned.",
    group: "ceiling",
  },
  climbCeiling: {
    id: "climbCeiling",
    label: "Ceiling crawl",
    description:
      "Crawling along a window underside. All frames loop in order (1→2→3→1…) while the pet moves sideways along the bottom of the window.",
    group: "ceiling",
  },
  emote: {
    id: "emote",
    label: "Emote 1",
    description:
      "First reaction loop. Frames play in order and repeat (1→2→3→1…) when triggered. Triggers not wired yet — assign each emote slot separately.",
    group: "emotes",
  },
  emote2: {
    id: "emote2",
    label: "Emote 2",
    description:
      "Second reaction loop — e.g. surprise, laugh, or wave. Frames loop in order (1→2→…→1) when played.",
    group: "emotes",
  },
  emote3: {
    id: "emote3",
    label: "Emote 3",
    description: "Third emote loop. Frames repeat in order (1→2→…→1) when triggered.",
    group: "emotes",
  },
  emote4: {
    id: "emote4",
    label: "Emote 4",
    description: "Fourth emote loop. Frames repeat in order (1→2→…→1) when triggered.",
    group: "emotes",
  },
  emote5: {
    id: "emote5",
    label: "Emote 5",
    description: "Fifth emote loop. Frames repeat in order (1→2→…→1) when triggered.",
    group: "emotes",
  },
  emote6: {
    id: "emote6",
    label: "Emote 6",
    description: "Sixth emote loop. Frames repeat in order (1→2→…→1) when triggered.",
    group: "emotes",
  },
};

export const ANIMATION_CATEGORY_GROUPS: AnimationCategoryGroup[] = [
  {
    id: "ground",
    label: "Ground",
    categories: ["idle", "walk", "floorCrawl"],
  },
  {
    id: "sit",
    label: "Sitting",
    categories: ["sit", "sitAlt", "sitAlt2", "sitOnBar", "dangleOnBar"],
  },
  {
    id: "air",
    label: "Air & landing",
    categories: ["fall", "bounce"],
  },
  {
    id: "drag",
    label: "Drag & throw",
    categories: [
      "dragLightLeft",
      "dragMildLeft",
      "dragStrongLeft",
      "dragLightRight",
      "dragMildRight",
      "dragStrongRight",
      "dragResist",
    ],
  },
  {
    id: "wall",
    label: "Wall",
    categories: ["grabWall", "climbWall"],
  },
  {
    id: "ceiling",
    label: "Ceiling",
    categories: ["grabCeiling", "climbCeiling"],
  },
  {
    id: "emotes",
    label: "Emotes",
    categories: ["emote", "emote2", "emote3", "emote4", "emote5", "emote6"],
  },
];

// old import buckets kept for reading legacy manifests
export const LEGACY_ANIMATION_CATEGORIES = ["drag", "thrown", "climb"] as const;
export type LegacyAnimationCategory =
  (typeof LEGACY_ANIMATION_CATEGORIES)[number];
