import {
  SPRITE_HEIGHT,
  TICK_INTERVAL_MS,
  TITLE_BAR_SIT_ANCHOR,
  UNDERSIDE_GRAB_ANCHOR,
  resolveDisplayAction,
} from "../animations/beyondBirthday";
import type {
  AnimationDefinition as RuntimeAnimation,
  CompanionAction,
  GrabbedLeanTier,
  SpriteAnchor,
} from "../animations/types";
import { LEGACY_ANIMATION_CATEGORIES } from "../constants/animationCategories";
import {
  ANIMATION_CATEGORIES,
  type AnimationCategory,
  type AnimationDefinition,
  type AnimationPlaybackStyle,
  type CharacterLibraryEntry,
  type CharacterManifest,
  type RandomSitAction,
} from "../types/character";
import type { SurfaceLock } from "../types/companion";
import type { CompanionMenuAnimationAction } from "../types/companionMenu";
import { characterDirPath } from "./fs/appPaths";
import { joinPath, toAssetUrl } from "./fs/fileSystemAdapter";

// transparent 1x1 png so a character missing an animation never renders broken
const FALLBACK_FRAME =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export type { AnimationPlaybackStyle };

// resolves a runtime animation + sprite geometry for whichever character a
// companion instance uses.
export interface AnimationRegistry {
  playbackStyle: AnimationPlaybackStyle;
  spriteWidth: number;
  spriteHeight: number;
  getAnimation: (action: CompanionAction) => RuntimeAnimation;
  getSpriteAnchor: (action: CompanionAction) => SpriteAnchor;
  resolveDisplayAction: (
    action: CompanionAction,
    lock: SurfaceLock | null,
  ) => CompanionAction;
  getGrabbedLeanFrame: (tier: GrabbedLeanTier) => string;
  // picks a floor sit variant among assigned sit / sitAlt / sitAlt2 slots
  pickFloorSitAction: (
    allowedActions?: readonly RandomSitAction[],
  ) => RandomSitAction | null;
  canFloorCrawl: boolean;
  contextMenuActions: readonly CompanionMenuAnimationAction[];
}

const FLOOR_SIT_ACTIONS: readonly RandomSitAction[] = [
  "sit",
  "sitAlt",
  "sitAlt2",
];

function isFloorSitAction(action: CompanionAction): boolean {
  return (FLOOR_SIT_ACTIONS as readonly CompanionAction[]).includes(action);
}

// each engine action maps to one manifest slot.
const ACTION_TO_CATEGORY: Record<CompanionAction, AnimationCategory> = {
  idle: "idle",
  walk: "walk",
  floorCrawl: "floorCrawl",
  sit: "sit",
  sitAlt: "sitAlt",
  sitAlt2: "sitAlt2",
  sitOnBar: "sitOnBar",
  dangleOnBar: "dangleOnBar",
  fall: "fall",
  bounce: "bounce",
  grabbed: "dragLightLeft",
  resist: "dragResist",
  grabWall: "grabWall",
  climbWall: "climbWall",
  climbWallDown: "climbWall",
  grabCeiling: "grabCeiling",
  climbCeiling: "climbCeiling",
  emote: "emote",
  emote2: "emote2",
  emote3: "emote3",
  emote4: "emote4",
  emote5: "emote5",
  emote6: "emote6",
};

const CONTEXT_MENU_ACTIONS: readonly CompanionMenuAnimationAction[] = [
  "sit",
  "sitAlt",
  "sitAlt2",
  "emote",
  "emote2",
  "emote3",
  "emote4",
  "emote5",
  "emote6",
];

const LEAN_TIER_TO_CATEGORY: Record<GrabbedLeanTier, AnimationCategory> = {
  lightLeft: "dragLightLeft",
  mildLeft: "dragMildLeft",
  strongLeft: "dragStrongLeft",
  lightRight: "dragLightRight",
  mildRight: "dragMildRight",
  strongRight: "dragStrongRight",
};

const LEAN_TIER_FRAME_RATIO: Record<GrabbedLeanTier, number> = {
  strongLeft: 0,
  mildLeft: 0.2,
  lightLeft: 0.5,
  lightRight: 0.5,
  mildRight: 0.8,
  strongRight: 1,
};

// when reading older manifests that only had drag / thrown / climb buckets
const LEGACY_CATEGORY_FALLBACKS: Partial<
  Record<AnimationCategory, readonly string[]>
> = {
  dragLightLeft: ["dragLightLeft", "dragNeutral", "drag"],
  dragLightRight: ["dragLightRight", "dragNeutral", "drag"],
  dragMildLeft: ["dragMildLeft", "drag"],
  dragStrongLeft: ["dragStrongLeft", "drag"],
  dragMildRight: ["dragMildRight", "drag"],
  dragStrongRight: ["dragStrongRight", "drag"],
  dragResist: ["dragResist", "drag"],
  fall: ["fall", "thrown"],
  bounce: ["bounce", "thrown"],
  grabWall: ["grabWall", "climb"],
  climbWall: ["climbWall", "climbWallUp", "climbWallDown", "climb"],
  grabCeiling: ["grabCeiling", "climb"],
  climbCeiling: ["climbCeiling", "climb"],
  sitAlt: ["sitAlt", "sit"],
  sitAlt2: ["sitAlt2", "sit"],
  sitOnBar: ["sitOnBar", "sit"],
  dangleOnBar: ["dangleOnBar", "sit"],
  emote: ["emote", "emotes"],
};

type LegacyAnimationCategory = (typeof LEGACY_ANIMATION_CATEGORIES)[number];

function fpsToTickDuration(fps: number): number {
  if (fps <= 0) {
    return 6;
  }
  return Math.max(1, Math.round(1000 / fps / TICK_INTERVAL_MS));
}

function actionVelocity(
  action: CompanionAction,
  speed: number,
): { x: number; y: number } {
  switch (action) {
    case "walk":
    case "floorCrawl":
    case "climbCeiling":
      return { x: -speed, y: 0 };
    case "climbWall":
      return { x: 0, y: -speed };
    case "climbWallDown":
      return { x: 0, y: speed };
    default:
      return { x: 0, y: 0 };
  }
}

function resolveActionVelocity(
  action: CompanionAction,
  configured: { x: number; y: number } | undefined,
  speed: number,
): { x: number; y: number } {
  const velocity = configured ?? actionVelocity(action, speed);

  if (action === "climbWall") {
    return { x: velocity.x, y: -Math.abs(velocity.y) };
  }

  if (action === "climbWallDown") {
    return { x: velocity.x, y: Math.abs(velocity.y) };
  }

  return velocity;
}

function importedSpriteAnchor(
  action: CompanionAction,
  width: number,
  height: number,
): SpriteAnchor {
  if (action === "sitOnBar" || action === "dangleOnBar") {
    return {
      x: width / 2,
      y: height * (TITLE_BAR_SIT_ANCHOR.y / SPRITE_HEIGHT),
    };
  }
  if (action === "grabCeiling" || action === "climbCeiling") {
    return {
      x: width / 2,
      y: height * (UNDERSIDE_GRAB_ANCHOR.y / SPRITE_HEIGHT),
    };
  }
  return { x: width / 2, y: height };
}

async function resolveCategoryFrames(
  characterId: string,
  definition: AnimationDefinition | undefined,
): Promise<string[]> {
  if (!definition || definition.frames.length === 0) {
    return [];
  }

  const dir = await characterDirPath(characterId);
  const urls: string[] = [];
  for (const frame of definition.frames) {
    urls.push(toAssetUrl(await joinPath(dir, frame.src)));
  }
  return urls;
}

interface ResolvedCategoryData {
  frames: string[];
  tickDuration: number;
  frameTickDurations?: number[];
}

function readLegacyDefinition(
  manifest: CharacterManifest,
  key: LegacyAnimationCategory,
): AnimationDefinition | undefined {
  const animations = manifest.animations as Partial<
    Record<AnimationCategory | LegacyAnimationCategory, AnimationDefinition>
  >;
  return animations[key];
}

function resolveCategoryDefinition(
  manifest: CharacterManifest,
  category: AnimationCategory,
): AnimationDefinition | undefined {
  if (manifest.animations[category]) {
    return manifest.animations[category];
  }

  const fallbacks = LEGACY_CATEGORY_FALLBACKS[category] ?? [category];
  for (const key of fallbacks) {
    if (key === "drag" || key === "thrown" || key === "climb") {
      const legacy = readLegacyDefinition(manifest, key);
      if (legacy) {
        return legacy;
      }
      continue;
    }

    if (manifest.animations[key as AnimationCategory]) {
      return manifest.animations[key as AnimationCategory];
    }
  }

  return undefined;
}

async function buildImportedRegistry(
  manifest: CharacterManifest,
): Promise<AnimationRegistry> {
  const speed = manifest.defaultSpeed;
  const width = manifest.frameWidth;
  const height = manifest.frameHeight;

  const categoryData = new Map<AnimationCategory, ResolvedCategoryData>();

  for (const slot of ANIMATION_CATEGORIES) {
    const definition = resolveCategoryDefinition(manifest, slot);
    const frames = await resolveCategoryFrames(manifest.id, definition);
    const tickDuration = definition
      ? fpsToTickDuration(definition.fps)
      : 6;
    const frameTickDurations = definition?.frames.some(
      (frame) => frame.durationTicks,
    )
      ? definition.frames.map(
          (frame) => frame.durationTicks ?? tickDuration,
        )
      : undefined;

    categoryData.set(slot, { frames, tickDuration, frameTickDurations });
  }

  const idleFrames = categoryData.get("idle")?.frames ?? [];

  const firstFrame = (category: AnimationCategory): string | undefined => {
    const data = categoryData.get(category);
    return data?.frames[0];
  };

  const framesForCategory = (category: AnimationCategory): string[] => {
    const data = categoryData.get(category);
    if (data && data.frames.length > 0) {
      return data.frames;
    }
    if (idleFrames.length > 0) {
      return idleFrames;
    }
    return [FALLBACK_FRAME];
  };

  const getAnimation = (action: CompanionAction): RuntimeAnimation => {
    const category = ACTION_TO_CATEGORY[action];
    const data = categoryData.get(category);
    const resolvedFrames = framesForCategory(category);
    const definition = resolveCategoryDefinition(manifest, category);

    return {
      frames: resolvedFrames,
      tickDuration: data?.tickDuration ?? 6,
      frameTickDurations: data?.frameTickDurations,
      velocity: resolveActionVelocity(action, definition?.velocity, speed),
    };
  };

  const hasCategoryFrames = (category: AnimationCategory): boolean => {
    const data = categoryData.get(category);
    return (data?.frames.length ?? 0) > 0;
  };

  const pickFloorSitAction = (
    allowedActions: readonly RandomSitAction[] = FLOOR_SIT_ACTIONS,
  ): RandomSitAction | null => {
    const available = FLOOR_SIT_ACTIONS.filter(
      (action) =>
        allowedActions.includes(action) &&
        hasCategoryFrames(ACTION_TO_CATEGORY[action]),
    );
    if (available.length === 0) {
      return null;
    }
    return available[Math.floor(Math.random() * available.length)];
  };

  const contextMenuActions = CONTEXT_MENU_ACTIONS.filter(
    (action) =>
      (manifest.animations[ACTION_TO_CATEGORY[action]]?.frames.length ?? 0) >
      0,
  );

  const resolveImportedDisplayAction = (
    action: CompanionAction,
    lock: SurfaceLock | null,
  ): CompanionAction => {
    if (lock?.kind === "titleBar" && isFloorSitAction(action)) {
      if (hasCategoryFrames("dangleOnBar")) {
        return "dangleOnBar";
      }
      if (hasCategoryFrames("sitOnBar")) {
        return "sitOnBar";
      }
      return action;
    }

    return resolveDisplayAction(action, lock);
  };

  const getGrabbedLeanFrame = (tier: GrabbedLeanTier): string => {
    const category = LEAN_TIER_TO_CATEGORY[tier];
    const data = categoryData.get(category);
    if (data && data.frames.length > 0) {
      if (data.frames.length === 1) {
        return data.frames[0];
      }

      // Old imports may have stored the whole Shimeji Pinched strip in every
      // lean bucket. Treat it as a pose strip: left -> neutral -> right.
      const index = Math.min(
        data.frames.length - 1,
        Math.max(
          0,
          Math.round((data.frames.length - 1) * LEAN_TIER_FRAME_RATIO[tier]),
        ),
      );
      return data.frames[index];
    }

    const lightLeft = firstFrame("dragLightLeft");
    if (lightLeft) {
      return lightLeft;
    }

    const lightRight = firstFrame("dragLightRight");
    if (lightRight) {
      return lightRight;
    }

    return framesForCategory("idle")[0] ?? FALLBACK_FRAME;
  };

  return {
    playbackStyle: manifest.playbackStyle ?? "sequential",
    spriteWidth: width,
    spriteHeight: height,
    getAnimation,
    getSpriteAnchor: (action) => importedSpriteAnchor(action, width, height),
    resolveDisplayAction: resolveImportedDisplayAction,
    getGrabbedLeanFrame,
    pickFloorSitAction,
    canFloorCrawl: hasCategoryFrames("floorCrawl"),
    contextMenuActions,
  };
}

export async function buildAnimationRegistry(
  entry: CharacterLibraryEntry,
): Promise<AnimationRegistry> {
  return buildImportedRegistry(entry.manifest);
}
