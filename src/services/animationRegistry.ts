import {
  SPRITE_HEIGHT,
  TICK_INTERVAL_MS,
  TITLE_BAR_SIT_ANCHOR,
  UNDERSIDE_GRAB_ANCHOR,
} from "../animations/companionGeometry";
import {
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
import type {
  ShimejiActionIntent,
  ShimejiAnimationGraph,
  ShimejiGraphAction,
  ShimejiGraphPose,
} from "../types/shimejiGraph";
import type { SurfaceLock } from "../types/companion";
import type { CompanionMenuAnimationAction } from "../types/companionMenu";
import { getMaxImageSize } from "../utils/frameGeometry";
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
  baseDisplayScale: number;
  getWallAnchorXOffset: (kind: "wallLeft" | "wallRight") => number;
  getUndersideAnchorYOffset: () => number;
  getAnimation: (action: CompanionAction) => RuntimeAnimation;
  getSpriteAnchor: (action: CompanionAction) => SpriteAnchor;
  resolveDisplayAction: (
    action: CompanionAction,
    lock: SurfaceLock | null,
  ) => CompanionAction;
  animateGrabbed: boolean;
  getGrabbedLeanFrame: (tier: GrabbedLeanTier) => string;
  // picks a sit variant among assigned sitting slots
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
  "sitOnBar",
  "dangleOnBar",
];

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
  "sitOnBar",
  "dangleOnBar",
  "emote",
  "emote2",
  "emote3",
  "emote4",
  "emote5",
  "emote6",
];

const EMOTE_ACTIONS: readonly CompanionMenuAnimationAction[] = [
  "emote",
  "emote2",
  "emote3",
  "emote4",
  "emote5",
  "emote6",
];

const ACTION_TO_SHIMEJI_INTENT: Partial<Record<CompanionAction, ShimejiActionIntent>> = {
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
  grabbed: "dragged",
  resist: "dragResist",
  grabWall: "grabWall",
  climbWall: "climbWall",
  climbWallDown: "climbWall",
  grabCeiling: "grabCeiling",
  climbCeiling: "climbCeiling",
};

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
  dangleOnBar: ["dangleOnBar", "sitOnBar", "sit"],
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
  const fallback = actionVelocity(action, speed);
  const velocity = configured ?? fallback;

  if (
    (action === "walk" ||
      action === "floorCrawl" ||
      action === "climbCeiling") &&
    velocity.x === 0
  ) {
    return fallback;
  }

  if (action === "climbWall") {
    const y = velocity.y === 0 ? fallback.y : velocity.y;
    return { x: velocity.x, y: -Math.abs(y) };
  }

  if (action === "climbWallDown") {
    const y = velocity.y === 0 ? fallback.y : velocity.y;
    return { x: velocity.x, y: Math.abs(y) };
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

function graphSpriteAnchor(
  action: CompanionAction,
  graph: ShimejiAnimationGraph,
): SpriteAnchor {
  const { spriteCanvas: canvas } = graph;

  if (action === "grabCeiling" || action === "climbCeiling") {
    return {
      x: canvas.anchor.x,
      y: canvas.height * (UNDERSIDE_GRAB_ANCHOR.y / SPRITE_HEIGHT),
    };
  }

  return canvas.anchor;
}

function displayOffsetToSpriteOffset(
  offset: number | undefined,
  baseDisplayScale: number,
): number {
  if (offset === undefined || !Number.isFinite(offset)) {
    return 0;
  }

  return offset / Math.max(baseDisplayScale, 0.001);
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
  let width = manifest.frameWidth;
  let height = manifest.frameHeight;

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

  const importedFrameSize = await getMaxImageSize(
    Array.from(
      new Set(
        Array.from(categoryData.values()).flatMap((data) => data.frames),
      ),
    ),
    { width, height },
  );
  width = Math.max(width, importedFrameSize.width);
  height = Math.max(height, importedFrameSize.height);

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
    baseDisplayScale: 1,
    getWallAnchorXOffset: (kind) => {
      const offset = displayOffsetToSpriteOffset(
        manifest.surfaceAttachmentOffsets?.wall,
        1,
      );
      return kind === "wallLeft" ? width / 2 + offset : width / 2 - offset;
    },
    getUndersideAnchorYOffset: () =>
      height * (UNDERSIDE_GRAB_ANCHOR.y / SPRITE_HEIGHT) -
      displayOffsetToSpriteOffset(
        manifest.surfaceAttachmentOffsets?.ceiling,
        1,
      ),
    getAnimation,
    getSpriteAnchor: (action) => importedSpriteAnchor(action, width, height),
    resolveDisplayAction,
    animateGrabbed: false,
    getGrabbedLeanFrame,
    pickFloorSitAction,
    canFloorCrawl: hasCategoryFrames("floorCrawl"),
    contextMenuActions,
  };
}

function flattenGraphAction(
  actionName: string,
  actions: Readonly<Record<string, ShimejiGraphAction>>,
  seen: ReadonlySet<string> = new Set(),
): ShimejiGraphPose[] {
  const action = actions[actionName];
  if (!action || seen.has(actionName)) {
    return [];
  }

  if (action.poses.length > 0) {
    return action.poses;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(actionName);
  return action.references.flatMap((reference) =>
    flattenGraphAction(reference.name, actions, nextSeen),
  );
}

function dangleLoopActionName(
  actionName: string,
  actions: Readonly<Record<string, ShimejiGraphAction>>,
): string {
  const action = actions[actionName];
  if (!action || action.poses.length > 0) {
    return actionName;
  }

  const referencedActions = action.references
    .map((reference) => actions[reference.name])
    .filter((reference): reference is ShimejiGraphAction => reference !== undefined);
  const loopingReference = referencedActions.find(
    (reference) =>
      reference.poses.length > 1 &&
      reference.poses.every((pose) => pose.durationTicks < 100),
  ) ?? referencedActions.find((reference) => reference.poses.length > 1);

  return loopingReference?.name ?? actionName;
}

function averagePoseVelocity(
  poses: readonly ShimejiGraphPose[],
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const moving = poses.filter(
    (pose) => pose.velocity.x !== 0 || pose.velocity.y !== 0,
  );
  if (moving.length === 0) {
    return fallback;
  }

  return {
    x: moving.reduce((total, pose) => total + pose.velocity.x, 0) / moving.length,
    y: moving.reduce((total, pose) => total + pose.velocity.y, 0) / moving.length,
  };
}

function shouldHoldFirstGraphPose(
  action: CompanionAction,
  actionName: string,
  graph: ShimejiAnimationGraph,
): boolean {
  return (
    (action === "grabWall" && actionName === graph.defaultActions.climbWall) ||
    (action === "grabCeiling" && actionName === graph.defaultActions.climbCeiling)
  );
}

async function graphPoseFrames(
  characterId: string,
  poses: readonly ShimejiGraphPose[],
): Promise<string[]> {
  const dir = await characterDirPath(characterId);
  const frames: string[] = [];

  for (const pose of poses) {
    if (pose.src) {
      frames.push(toAssetUrl(await joinPath(dir, pose.src)));
    }
  }

  return frames;
}

async function buildShimejiGraphRegistry(
  manifest: CharacterManifest,
): Promise<AnimationRegistry> {
  const graph = manifest.shimejiGraph;
  if (!graph) {
    return buildImportedRegistry(manifest);
  }

  const semanticActions = new Map<CompanionAction, RuntimeAnimation>();
  const posesByAction = new Map<CompanionAction, ShimejiGraphPose[]>();
  const fallbackVelocity = (action: CompanionAction) =>
    actionVelocity(action, manifest.defaultSpeed);

  const resolveActionName = (action: CompanionAction): string | undefined => {
    const emoteIndex = EMOTE_ACTIONS.indexOf(action as CompanionMenuAnimationAction);
    if (emoteIndex >= 0) {
      return graph.menuActions[emoteIndex]?.actionName;
    }

    const intent = ACTION_TO_SHIMEJI_INTENT[action];
    const actionName = intent ? graph.defaultActions[intent] : undefined;
    return action === "dangleOnBar" && actionName
      ? dangleLoopActionName(actionName, graph.actions)
      : actionName;
  };

  for (const action of Object.keys(ACTION_TO_CATEGORY) as CompanionAction[]) {
    const actionName = resolveActionName(action);
    const flattenedPoses = actionName ? flattenGraphAction(actionName, graph.actions) : [];
    const poses =
      actionName && shouldHoldFirstGraphPose(action, actionName, graph)
        ? flattenedPoses.slice(0, 1)
        : flattenedPoses;
    posesByAction.set(action, poses);
    const frames = await graphPoseFrames(manifest.id, poses);
    semanticActions.set(action, {
      frames,
      tickDuration: 6,
      frameTickDurations: poses.length > 0
        ? poses.map((pose) => pose.durationTicks)
        : undefined,
      velocity: resolveActionVelocity(
        action,
        averagePoseVelocity(poses, fallbackVelocity(action)),
        manifest.defaultSpeed,
      ),
    });
  }

  const hasFrames = (action: CompanionAction): boolean =>
    (posesByAction.get(action)?.length ?? 0) > 0;
  const firstFrame = (action: CompanionAction): string | undefined => {
    const animation = semanticActions.get(action);
    return hasFrames(action) ? animation?.frames[0] : undefined;
  };
  const idleFallback = semanticActions.get("idle");

  const getAnimation = (action: CompanionAction): RuntimeAnimation => {
    const animation = semanticActions.get(action);
    if (animation && animation.frames.length > 0) {
      return animation;
    }

    if (idleFallback && idleFallback.frames.length > 0) {
      return {
        frames: idleFallback.frames,
        tickDuration: animation?.tickDuration ?? idleFallback.tickDuration,
        frameTickDurations: idleFallback.frameTickDurations,
        velocity: animation?.velocity ?? fallbackVelocity(action),
      };
    }

    return {
      frames: [FALLBACK_FRAME],
      tickDuration: 6,
      velocity: animation?.velocity ?? fallbackVelocity(action),
    };
  };

  const contextMenuActions = [
    ...FLOOR_SIT_ACTIONS.filter((action) => hasFrames(action)),
    ...EMOTE_ACTIONS.slice(0, graph.menuActions.length).filter((action) =>
      hasFrames(action as CompanionAction),
    ),
  ];
  const baseDisplayScale = graph.baseDisplayScale ?? 1;
  const wallOffset = displayOffsetToSpriteOffset(
    manifest.surfaceAttachmentOffsets?.wall,
    baseDisplayScale,
  );
  const ceilingOffset = displayOffsetToSpriteOffset(
    manifest.surfaceAttachmentOffsets?.ceiling,
    baseDisplayScale,
  );

  return {
    playbackStyle: "sequential",
    spriteWidth: graph.spriteCanvas.width,
    spriteHeight: graph.spriteCanvas.height,
    baseDisplayScale,
    getWallAnchorXOffset: (kind) =>
      kind === "wallLeft"
        ? graph.spriteCanvas.width / 2 + wallOffset
        : graph.spriteCanvas.width / 2 - wallOffset,
    getUndersideAnchorYOffset: () =>
      graph.spriteCanvas.height * (UNDERSIDE_GRAB_ANCHOR.y / SPRITE_HEIGHT) -
      ceilingOffset,
    getAnimation,
    getSpriteAnchor: (action) => graphSpriteAnchor(action, graph),
    resolveDisplayAction,
    animateGrabbed: false,
    getGrabbedLeanFrame: (tier) => {
      const frames = semanticActions.get("grabbed")?.frames ?? [];
      const usableFrames =
        frames.length > 0 && frames[0] !== FALLBACK_FRAME ? frames : [];

      if (usableFrames.length === 1) {
        return usableFrames[0];
      }

      if (usableFrames.length > 1) {
        const index = Math.min(
          usableFrames.length - 1,
          Math.max(
            0,
            Math.round(
              (usableFrames.length - 1) * LEAN_TIER_FRAME_RATIO[tier],
            ),
          ),
        );
        return usableFrames[index];
      }

      return firstFrame("resist") ?? firstFrame("idle") ?? FALLBACK_FRAME;
    },
    pickFloorSitAction: (allowedActions = FLOOR_SIT_ACTIONS) => {
      const available = FLOOR_SIT_ACTIONS.filter(
        (action) => allowedActions.includes(action) && hasFrames(action),
      );
      return available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : null;
    },
    canFloorCrawl: hasFrames("floorCrawl"),
    contextMenuActions,
  };
}

export async function buildAnimationRegistry(
  entry: CharacterLibraryEntry,
): Promise<AnimationRegistry> {
  if (entry.manifest.animationSystem === "shimejiGraph") {
    return buildShimejiGraphRegistry(entry.manifest);
  }

  return buildImportedRegistry(entry.manifest);
}
