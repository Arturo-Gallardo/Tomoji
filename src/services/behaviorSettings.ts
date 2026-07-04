import type { BehaviorSettings, RandomSitAction } from "../types/character";

export const RANDOM_SIT_ACTIONS: readonly RandomSitAction[] = [
  "sit",
  "sitAlt",
  "sitAlt2",
];

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
  movementSpeed: 1,
  actionFrequency: 0.5,
  dialogueFrequency: 0.2,
  allowRandomWalk: true,
  allowRandomFloorCrawl: true,
  floorCrawlFrequency: 0.25,
  allowRandomSit: true,
  randomSitActions: [...RANDOM_SIT_ACTIONS],
  allowRandomWallClimb: true,
  allowRandomCeilingCrawl: true,
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
    allowRandomFloorCrawl:
      settings?.allowRandomFloorCrawl ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomFloorCrawl,
    floorCrawlFrequency: clamp01(
      settings?.floorCrawlFrequency ??
        DEFAULT_BEHAVIOR_SETTINGS.floorCrawlFrequency,
    ),
    allowRandomSit:
      settings?.allowRandomSit ?? DEFAULT_BEHAVIOR_SETTINGS.allowRandomSit,
    randomSitActions: normalizeRandomSitActions(settings?.randomSitActions),
    allowRandomWallClimb:
      settings?.allowRandomWallClimb ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomWallClimb,
    allowRandomCeilingCrawl:
      settings?.allowRandomCeilingCrawl ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomCeilingCrawl,
    allowRandomDialogue:
      settings?.allowRandomDialogue ??
      DEFAULT_BEHAVIOR_SETTINGS.allowRandomDialogue,
  };
}
