import { useCallback, useMemo, useState } from "react";
import {
  listShimejiFrames,
  loadCharacterDraft,
  pickShimejiImgFolder,
} from "../services/shimejiImporter";
import { DEFAULT_BEHAVIOR_SETTINGS } from "../services/behaviorSettings";
import { ANIMATION_CATEGORIES } from "../types/character";
import type { AnimationCategory, BehaviorSettings } from "../types/character";
import type {
  CategoryAssignments,
  ShimejiDraft,
} from "../types/shimejiDraft";
import { getImageSize } from "../utils/imageSize";

const DEFAULT_FPS = 8;
const DEFAULT_FRAME_SIZE = 128;
const MAX_AUTO_SCALE = 4;

function emptyAssignments(): CategoryAssignments {
  return ANIMATION_CATEGORIES.reduce((accumulator, category) => {
    accumulator[category] = { frames: [], fps: DEFAULT_FPS };
    return accumulator;
  }, {} as CategoryAssignments);
}

function initialDraft(): ShimejiDraft {
  return {
    imgDir: null,
    sources: [],
    assignments: emptyAssignments(),
    name: "",
    dialogueLines: [],
    dialogueFrequency: 0.2,
    behavior: { ...DEFAULT_BEHAVIOR_SETTINGS },
    scale: 1,
    speed: 2,
    frameWidth: DEFAULT_FRAME_SIZE,
    frameHeight: DEFAULT_FRAME_SIZE,
  };
}

function isLikelySpriteFrame(source: { name: string }): boolean {
  const name = source.name.toLowerCase();
  return (
    name.startsWith("shime") &&
    !name.startsWith("icon.") &&
    !name.startsWith("banner")
  );
}

function defaultScaleForFrameHeight(frameHeight: number): number {
  if (frameHeight >= DEFAULT_FRAME_SIZE) {
    return 1;
  }

  return Math.min(MAX_AUTO_SCALE, DEFAULT_FRAME_SIZE / frameHeight);
}

export function useShimejiDraft() {
  const [draft, setDraft] = useState<ShimejiDraft>(initialDraft);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);

  const urlByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const source of draft.sources) {
      map.set(source.path, source.url);
    }
    return map;
  }, [draft.sources]);

  const urlFor = useCallback(
    (path: string) => urlByPath.get(path) ?? path,
    [urlByPath],
  );

  const framesUrls = useCallback(
    (category: AnimationCategory) =>
      draft.assignments[category].frames.map((path) => urlFor(path)),
    [draft.assignments, urlFor],
  );

  const loadFromCharacter = useCallback(async (characterId: string) => {
    setIsLoadingFolder(true);
    try {
      const next = await loadCharacterDraft(characterId);
      setDraft(next);
    } finally {
      setIsLoadingFolder(false);
    }
  }, []);

  // merges new image files into the picker without clearing assignments
  const mergeImgFolder = useCallback(async () => {
    const dir = await pickShimejiImgFolder();
    if (dir === null) {
      return;
    }

    setIsLoadingFolder(true);
    try {
      const incoming = await listShimejiFrames(dir);
      setDraft((current) => {
        const known = new Set(current.sources.map((source) => source.path));
        const merged = [...current.sources];

        for (const source of incoming) {
          if (known.has(source.path)) {
            continue;
          }
          merged.push(source);
          known.add(source.path);
        }

        merged.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );

        return { ...current, sources: merged };
      });
    } finally {
      setIsLoadingFolder(false);
    }
  }, []);

  const loadImgFolder = useCallback(async () => {
    const dir = await pickShimejiImgFolder();
    if (dir === null) {
      return;
    }

    setIsLoadingFolder(true);
    try {
      const sources = await listShimejiFrames(dir);
      let frameWidth = DEFAULT_FRAME_SIZE;
      let frameHeight = DEFAULT_FRAME_SIZE;

      const sizeSource =
        sources.find(isLikelySpriteFrame) ??
        sources.find((source) => !source.name.toLowerCase().startsWith("icon."));

      if (sizeSource) {
        try {
          const size = await getImageSize(sizeSource.url);
          frameWidth = size.width;
          frameHeight = size.height;
        } catch {
          // fall back to the default frame size if the image can't be measured
        }
      }

      setDraft((current) => ({
        ...current,
        imgDir: dir,
        sources,
        assignments: emptyAssignments(),
        scale: defaultScaleForFrameHeight(frameHeight),
        frameWidth,
        frameHeight,
      }));
    } finally {
      setIsLoadingFolder(false);
    }
  }, []);

  const addFrame = useCallback(
    (category: AnimationCategory, path: string) => {
      setDraft((current) => {
        const assignment = current.assignments[category];

        return {
          ...current,
          assignments: {
            ...current.assignments,
            [category]: {
              ...assignment,
              frames: [...assignment.frames, path],
            },
          },
        };
      });
    },
    [],
  );

  const removeFrame = useCallback(
    (category: AnimationCategory, index: number) => {
      setDraft((current) => {
        const assignment = current.assignments[category];
        const frames = assignment.frames.filter((_, i) => i !== index);
        return {
          ...current,
          assignments: {
            ...current.assignments,
            [category]: { ...assignment, frames },
          },
        };
      });
    },
    [],
  );

  // removes the last copy of a source frame — pairs with left-click add
  const removeLastFrameByPath = useCallback(
    (category: AnimationCategory, path: string) => {
      setDraft((current) => {
        const assignment = current.assignments[category];
        const lastIndex = assignment.frames.lastIndexOf(path);
        if (lastIndex === -1) {
          return current;
        }

        const frames = assignment.frames.filter((_, index) => index !== lastIndex);
        return {
          ...current,
          assignments: {
            ...current.assignments,
            [category]: { ...assignment, frames },
          },
        };
      });
    },
    [],
  );

  const moveFrame = useCallback(
    (category: AnimationCategory, index: number, direction: -1 | 1) => {
      setDraft((current) => {
        const assignment = current.assignments[category];
        const target = index + direction;
        if (target < 0 || target >= assignment.frames.length) {
          return current;
        }

        const frames = [...assignment.frames];
        [frames[index], frames[target]] = [frames[target], frames[index]];

        return {
          ...current,
          assignments: {
            ...current.assignments,
            [category]: { ...assignment, frames },
          },
        };
      });
    },
    [],
  );

  const setFps = useCallback((category: AnimationCategory, fps: number) => {
    setDraft((current) => ({
      ...current,
      assignments: {
        ...current.assignments,
        [category]: { ...current.assignments[category], fps },
      },
    }));
  }, []);

  const setName = useCallback((name: string) => {
    setDraft((current) => ({ ...current, name }));
  }, []);

  const addDialogueLine = useCallback((line: string) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      return;
    }
    setDraft((current) => ({
      ...current,
      dialogueLines: [...current.dialogueLines, trimmed],
    }));
  }, []);

  const removeDialogueLine = useCallback((index: number) => {
    setDraft((current) => ({
      ...current,
      dialogueLines: current.dialogueLines.filter((_, i) => i !== index),
    }));
  }, []);

  const setDialogueFrequency = useCallback((dialogueFrequency: number) => {
    setDraft((current) => ({ ...current, dialogueFrequency }));
  }, []);

  const patchBehavior = useCallback((patch: Partial<BehaviorSettings>) => {
    setDraft((current) => ({
      ...current,
      behavior: { ...current.behavior, ...patch },
    }));
  }, []);

  const setScale = useCallback((scale: number) => {
    setDraft((current) => ({ ...current, scale }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setDraft((current) => ({ ...current, speed }));
  }, []);

  return {
    draft,
    isLoadingFolder,
    urlFor,
    framesUrls,
    loadFromCharacter,
    mergeImgFolder,
    loadImgFolder,
    addFrame,
    removeFrame,
    removeLastFrameByPath,
    moveFrame,
    setFps,
    setName,
    addDialogueLine,
    removeDialogueLine,
    setDialogueFrequency,
    patchBehavior,
    setScale,
    setSpeed,
  };
}

export type ShimejiDraftController = ReturnType<typeof useShimejiDraft>;
