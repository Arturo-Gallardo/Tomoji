import type { AnimationCategory, BehaviorSettings } from "./character";

// a single source image picked from the Shimeji img folder
export interface ShimejiSourceFrame {
  name: string;
  path: string;
  url: string;
}

export interface CategoryAssignment {
  // ordered list of source frame paths assigned to this category
  frames: string[];
  fps: number;
  // optional per-frame Shimeji duration in 25ms engine ticks
  durationTicks?: number[];
}

export type CategoryAssignments = Record<AnimationCategory, CategoryAssignment>;

// in-progress (non-persisted) state for the Shimeji import wizard
export interface ShimejiDraft {
  imgDir: string | null;
  sources: ShimejiSourceFrame[];
  assignments: CategoryAssignments;
  name: string;
  dialogueLines: string[];
  dialogueFrequency: number;
  behavior: BehaviorSettings;
  scale: number;
  speed: number;
  frameWidth: number;
  frameHeight: number;
}
