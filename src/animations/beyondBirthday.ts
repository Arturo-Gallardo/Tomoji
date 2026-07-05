import type { CompanionAction, GrabbedLeanTier, SpriteAnchor } from "./types";
import type { SurfaceLock } from "../types/companion";
import {
  SPRITE_ANCHOR,
  TITLE_BAR_SIT_ANCHOR,
  UNDERSIDE_GRAB_ANCHOR,
} from "./companionGeometry";

// grabbed lean reference thresholds in px/tick (25ms cadence)
export const GRAB_VELOCITY_STRONG = 6;
export const GRAB_VELOCITY_MILD = 2;

// hysteresis — enter higher, exit lower so slow drags dont flicker tiers
export const GRAB_EXIT_LIGHT = 0.5;
export const GRAB_ENTER_MILD = 2.5;
export const GRAB_EXIT_MILD = 1;
export const GRAB_ENTER_STRONG = 6.5;
export const GRAB_EXIT_STRONG = 4.5;

export type { GrabbedLeanTier } from "./types";

export function usesTitleBarSitAnchor(action: CompanionAction): boolean {
  return action === "sitOnBar" || action === "dangleOnBar";
}

export function usesUndersideGrabAnchor(action: CompanionAction): boolean {
  return action === "grabCeiling" || action === "climbCeiling";
}

// when locked to a surface, swap movement actions for wall / underside poses
export function resolveDisplayAction(
  action: CompanionAction,
  surfaceLock: SurfaceLock | null,
): CompanionAction {
  if (!surfaceLock) {
    return action;
  }

  if (surfaceLock.kind === "wallLeft" || surfaceLock.kind === "wallRight") {
    if (action === "climbWall" || action === "climbWallDown") {
      return action;
    }

    return "grabWall";
  }

  if (surfaceLock.kind === "underside") {
    if (action === "climbCeiling") {
      return action;
    }

    if (action === "idle" || action === "walk") {
      return "grabCeiling";
    }
  }

  return action;
}

export function getSpriteAnchorForAction(
  action: CompanionAction,
): SpriteAnchor {
  if (usesTitleBarSitAnchor(action)) {
    return TITLE_BAR_SIT_ANCHOR;
  }

  if (usesUndersideGrabAnchor(action)) {
    return UNDERSIDE_GRAB_ANCHOR;
  }

  return SPRITE_ANCHOR;
}

function lightTierFromLean(lean: number): GrabbedLeanTier {
  return lean < 0 ? "lightLeft" : "lightRight";
}

// lean opposes drag direction, matching existing Shimeji sprite assignments
export function resolveGrabbedLeanTier(
  previous: GrabbedLeanTier,
  velocityX: number,
): GrabbedLeanTier {
  const lean = -velocityX;

  switch (previous) {
    case "strongLeft":
      if (lean > -GRAB_EXIT_STRONG) {
        if (lean > -GRAB_EXIT_MILD) {
          return lean > GRAB_EXIT_LIGHT
            ? "lightRight"
            : lightTierFromLean(lean);
        }
        return "mildLeft";
      }
      return "strongLeft";

    case "mildLeft":
      if (lean < -GRAB_ENTER_STRONG) {
        return "strongLeft";
      }
      if (lean > -GRAB_EXIT_MILD) {
        return lean > GRAB_EXIT_LIGHT ? "lightRight" : "lightLeft";
      }
      return "mildLeft";

    case "lightLeft":
      if (lean < -GRAB_ENTER_STRONG) {
        return "strongLeft";
      }
      if (lean < -GRAB_ENTER_MILD) {
        return "mildLeft";
      }
      if (lean > GRAB_ENTER_STRONG) {
        return "strongRight";
      }
      if (lean > GRAB_ENTER_MILD) {
        return "mildRight";
      }
      if (lean > GRAB_EXIT_LIGHT) {
        return "lightRight";
      }
      return "lightLeft";

    case "strongRight":
      if (lean < GRAB_EXIT_STRONG) {
        if (lean < GRAB_EXIT_MILD) {
          return lean < -GRAB_EXIT_LIGHT ? "lightLeft" : "lightRight";
        }
        return "mildRight";
      }
      return "strongRight";

    case "mildRight":
      if (lean > GRAB_ENTER_STRONG) {
        return "strongRight";
      }
      if (lean < GRAB_EXIT_MILD) {
        return lean < -GRAB_EXIT_LIGHT ? "lightLeft" : "lightRight";
      }
      return "mildRight";

    case "lightRight":
      if (lean > GRAB_ENTER_STRONG) {
        return "strongRight";
      }
      if (lean > GRAB_ENTER_MILD) {
        return "mildRight";
      }
      if (lean < -GRAB_ENTER_STRONG) {
        return "strongLeft";
      }
      if (lean < -GRAB_ENTER_MILD) {
        return "mildLeft";
      }
      if (lean < -GRAB_EXIT_LIGHT) {
        return "lightLeft";
      }
      return "lightRight";
  }
}
