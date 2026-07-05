import type { BehaviorSettings, RandomSitAction } from "../types/character";

export const RANDOM_SIT_ACTIONS: readonly RandomSitAction[] = [
  "sit",
  "sitAlt",
  "sitAlt2",
  "sitOnBar",
  "dangleOnBar",
];

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
  movementSpeed: 1,
  actionFrequency: 0.5,
  dialogueFrequency: 0.2,
  allowRandomWalk: true,
  walkFrequency: 1,
  allowRandomFloorCrawl: true,
  floorCrawlFrequency: 0.1,
  allowRandomSit: true,
  sitFrequency: 0.35,
  randomSitActions: [...RANDOM_SIT_ACTIONS],
  allowRandomWallClimb: true,
  wallClimbFrequency: 1,
  allowRandomCeilingCrawl: true,
  ceilingCrawlFrequency: 1,
  allowRandomDialogue: true,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeRandomSitActions(
  actions: readonly RandomSitAction[] | undefined,
): RandomSitAction[] {
  if (actions === undefined) {
    return [...RANDOM_SIT_ACTIONS];
  }

  return RANDOM_SIT_ACTIONS.filter((action) => actions.includes(action));
}

function normalizeFloorCrawlFrequency(
  settings: Partial<BehaviorSettings> | undefined,
): number {
  // old default was too crawl-heavy. if this is an older saved config, migrate
  // the old default down while leaving newer explicit slider values alone.
  if (
    settings?.floorCrawlFrequency === 0.25 &&
    settings.walkFrequency === undefined
  ) {
    return DEFAULT_BEHAVIOR_SETTINGS.floorCrawlFrequency;
  }

  return clamp01(
    settings?.floorCrawlFrequency ??
      DEFAULT_BEHAVIOR_SETTINGS.floorCrawlFrequency,
  );
}

// fills in any missing fields and clamps the 0..1 frequencies so persisted or
// imported settings can never push the behavior engine out of range.
export function normalizeBehaviorSettings(
  settings: Partial<BehaviorSettings> | undefined,
): BehaviorSettings {
  return {
    movementSpeed: Math.max(
      0.1,
      settings?.movementSpeed ?? DEFAULT_BEHAVIOR_SETTINGS.movementSpeed,
    ),
    actionFrequency: clamp01(
      settings?.actionFrequency ?? DEFAULT_BEHAVIOR_SETTINGS.actionFrequency,
    ),
    dialogueFrequency: clamp01(
      settings?.dialogueFrequency ?? DEFAULT_BEHAVIOR_SETTINGS.dialogueFrequency,
    ),
    allowRandomWalk:
      settings?.allowRandomWalk ?? DEFAULT_BEHAVIOR_SETTINGS.allowRandomWalk,
    walkFrequency: clamp01(
      settings?.walkFrequency ?? DEFAULT_BEHAVIOR_SETTINGS.walkFrequency,
    ),
    allowRandomFloorCrawl:
      settings?.allowRandomFloorCrawl ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomFloorCrawl,
    floorCrawlFrequency: normalizeFloorCrawlFrequency(settings),
    allowRandomSit:
      settings?.allowRandomSit ?? DEFAULT_BEHAVIOR_SETTINGS.allowRandomSit,
    sitFrequency: clamp01(
      settings?.sitFrequency ?? DEFAULT_BEHAVIOR_SETTINGS.sitFrequency,
    ),
    randomSitActions: normalizeRandomSitActions(settings?.randomSitActions),
    allowRandomWallClimb:
      settings?.allowRandomWallClimb ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomWallClimb,
    wallClimbFrequency: clamp01(
      settings?.wallClimbFrequency ??
        DEFAULT_BEHAVIOR_SETTINGS.wallClimbFrequency,
    ),
    allowRandomCeilingCrawl:
      settings?.allowRandomCeilingCrawl ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomCeilingCrawl,
    ceilingCrawlFrequency: clamp01(
      settings?.ceilingCrawlFrequency ??
        DEFAULT_BEHAVIOR_SETTINGS.ceilingCrawlFrequency,
    ),
    allowRandomDialogue:
      settings?.allowRandomDialogue ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomDialogue,
  };
}
