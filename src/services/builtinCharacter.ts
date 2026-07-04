import { emit } from "@tauri-apps/api/event";
import { TICK_INTERVAL_MS } from "../animations/beyondBirthday";
import { BUILTIN_DEFAULT_DIALOGUE_LINES } from "../content/motivationalQuotes";
import type {
  AnimationCategory,
  AnimationDefinition,
  CharacterLibraryEntry,
  CharacterManifest,
} from "../types/character";
import {
  characterDirPath,
  characterManifestPath,
  libraryFilePath,
} from "./fs/appPaths";
import {
  ensureDir,
  joinPath,
  pathExists,
  readJson,
  removePath,
  writeBinary,
  writeJson,
} from "./fs/fileSystemAdapter";

export const BUILTIN_CHARACTER_ID = "beyond-birthday";
export const BUILTIN_STORAGE_VERSION = 2;

const BUNDLE_ASSET_BASES = [
  "/companion/beyond-birthday",
  "/img-BeyondBirthday",
] as const;

interface SeedFrame {
  file: string;
  durationTicks?: number;
}

function ticksToFps(tickDuration: number): number {
  return 1000 / tickDuration / TICK_INTERVAL_MS;
}

function buildCategoryAnimation(
  category: AnimationCategory,
  frames: SeedFrame[],
  tickDuration: number,
  velocity?: { x: number; y: number },
): AnimationDefinition {
  return {
    fps: ticksToFps(tickDuration),
    velocity,
    frames: frames.map((frame, index) => ({
      src: `sprites/${category}/${index}.png`,
      ...(frame.durationTicks !== undefined
        ? { durationTicks: frame.durationTicks }
        : {}),
    })),
  };
}

interface SeedAnimationSpec {
  frames: SeedFrame[];
  tickDuration: number;
  velocity?: { x: number; y: number };
}

const SEED_ANIMATIONS: Partial<Record<AnimationCategory, SeedAnimationSpec>> = {
  idle: { frames: [{ file: "shime1.png" }], tickDuration: 6 },
  walk: {
    frames: [
      { file: "shime1.png" },
      { file: "shime2.png" },
      { file: "shime3.png" },
    ],
    tickDuration: 6,
    velocity: { x: -2, y: 0 },
  },
  sit: { frames: [{ file: "shime15.png" }], tickDuration: 250 },
  sitAlt: { frames: [{ file: "shime15.png" }], tickDuration: 250 },
  sitAlt2: { frames: [{ file: "shime15.png" }], tickDuration: 250 },
  sitOnBar: { frames: [{ file: "shime31.png" }], tickDuration: 250 },
  dangleOnBar: {
    frames: [
      { file: "shime31.png", durationTicks: 5 },
      { file: "shime32.png", durationTicks: 15 },
      { file: "shime31.png", durationTicks: 5 },
      { file: "shime33.png", durationTicks: 15 },
    ],
    tickDuration: 5,
  },
  fall: { frames: [{ file: "shime4.png" }], tickDuration: 250 },
  bounce: {
    frames: [{ file: "shime18.png" }, { file: "shime19.png" }],
    tickDuration: 4,
  },
  dragResist: {
    frames: [{ file: "shime5.png" }, { file: "shime6.png" }],
    tickDuration: 5,
  },
  dragLightLeft: { frames: [{ file: "shime1.png" }], tickDuration: 5 },
  dragLightRight: { frames: [{ file: "shime1.png" }], tickDuration: 5 },
  dragMildLeft: { frames: [{ file: "shime7.png" }], tickDuration: 5 },
  dragMildRight: { frames: [{ file: "shime8.png" }], tickDuration: 5 },
  dragStrongLeft: { frames: [{ file: "shime9.png" }], tickDuration: 5 },
  dragStrongRight: { frames: [{ file: "shime10.png" }], tickDuration: 5 },
  grabWall: { frames: [{ file: "shime13.png" }], tickDuration: 250 },
  climbWall: {
    frames: [
      { file: "shime14.png", durationTicks: 16 },
      { file: "shime12.png", durationTicks: 4 },
    ],
    tickDuration: 4,
    velocity: { x: 0, y: -2 },
  },
  grabCeiling: { frames: [{ file: "shime23.png" }], tickDuration: 250 },
  climbCeiling: {
    frames: [
      { file: "shime25.png", durationTicks: 16 },
      { file: "shime25.png", durationTicks: 4 },
      { file: "shime23.png", durationTicks: 4 },
      { file: "shime24.png", durationTicks: 16 },
      { file: "shime24.png", durationTicks: 4 },
      { file: "shime24.png", durationTicks: 4 },
      { file: "shime23.png", durationTicks: 4 },
      { file: "shime25.png", durationTicks: 4 },
    ],
    tickDuration: 4,
    velocity: { x: -2, y: 0 },
  },
};

function createDefaultAnimations(): CharacterManifest["animations"] {
  const animations: CharacterManifest["animations"] = {};

  for (const [category, spec] of Object.entries(SEED_ANIMATIONS) as [
    AnimationCategory,
    SeedAnimationSpec,
  ][]) {
    animations[category] = buildCategoryAnimation(
      category,
      spec.frames,
      spec.tickDuration,
      spec.velocity,
    );
  }

  return animations;
}

function createDefaultManifest(): CharacterManifest {
  return {
    id: BUILTIN_CHARACTER_ID,
    name: "Beyond Birthday",
    version: "1.0.0",
    author: "Tomoji",
    defaultScale: 1,
    defaultSpeed: 2,
    frameWidth: 128,
    frameHeight: 128,
    animations: createDefaultAnimations(),
    behaviorSettings: {
      movementSpeed: 1,
      actionFrequency: 0.5,
      dialogueFrequency: 0.2,
      allowRandomWalk: true,
      walkFrequency: 1,
      allowRandomFloorCrawl: true,
      floorCrawlFrequency: 0.1,
      allowRandomSit: true,
      sitFrequency: 0.35,
      randomSitActions: ["sit", "sitAlt", "sitAlt2"],
      allowRandomWallClimb: true,
      wallClimbFrequency: 1,
      allowRandomCeilingCrawl: true,
      ceilingCrawlFrequency: 1,
      allowRandomDialogue: true,
    },
    dialogueSettings: {
      lines: [...BUILTIN_DEFAULT_DIALOGUE_LINES],
      frequency: 0.2,
    },
    playbackStyle: "shimeji",
    storageVersion: BUILTIN_STORAGE_VERSION,
  };
}

function needsModularUpgrade(manifest: CharacterManifest): boolean {
  return (
    manifest.storageVersion !== BUILTIN_STORAGE_VERSION ||
    (manifest.animations.idle?.frames.length ?? 0) === 0
  );
}

function mergeExistingManifest(
  existing: CharacterManifest | null,
): CharacterManifest {
  const defaults = createDefaultManifest();
  if (existing === null) {
    return defaults;
  }

  return {
    ...defaults,
    name: existing.name,
    defaultScale: existing.defaultScale,
    defaultSpeed: existing.defaultSpeed,
    behaviorSettings: existing.behaviorSettings,
    dialogueSettings:
      existing.dialogueSettings.lines.length > 0
        ? existing.dialogueSettings
        : defaults.dialogueSettings,
  };
}

async function fetchBundledSprite(fileName: string): Promise<Uint8Array | null> {
  for (const base of BUNDLE_ASSET_BASES) {
    const response = await fetch(`${base}/${fileName}`);
    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
  }

  return null;
}

async function seedSprites(characterDir: string): Promise<void> {
  for (const [category, spec] of Object.entries(SEED_ANIMATIONS) as [
    AnimationCategory,
    SeedAnimationSpec,
  ][]) {
    const categoryDir = await joinPath(characterDir, "sprites", category);
    await ensureDir(categoryDir);

    for (let index = 0; index < spec.frames.length; index += 1) {
      const destPath = await joinPath(categoryDir, `${index}.png`);
      if (await pathExists(destPath)) {
        continue;
      }

      const bytes = await fetchBundledSprite(spec.frames[index].file);
      if (bytes === null) {
        continue;
      }

      await writeBinary(destPath, bytes);
    }
  }
}

async function readLibraryFile(): Promise<CharacterLibraryEntry[]> {
  const path = await libraryFilePath();
  if (!(await pathExists(path))) {
    return [];
  }

  try {
    const file = await readJson<{ characters?: CharacterLibraryEntry[] }>(path);
    return file.characters ?? [];
  } catch (error) {
    console.error("failed to read character library", error);
    return [];
  }
}

async function writeLibraryEntry(entry: CharacterLibraryEntry): Promise<void> {
  const stored = await readLibraryFile();
  const next = [
    entry,
    ...stored.filter(
      (existing) => existing.manifest.id !== BUILTIN_CHARACTER_ID,
    ),
  ];
  await writeJson(await libraryFilePath(), {
    version: 1,
    characters: next,
  });
  await emit("character-library-changed");
}

function toLibraryEntry(
  manifest: CharacterManifest,
  folderPath: string,
): CharacterLibraryEntry {
  return {
    manifest,
    source: "builtin",
    folderPath,
  };
}

// writes beyond-birthday under <appData>/characters using the same manifest +
// sprites layout as every other Tomoji. bundled assets are copied on first run
// or when upgrading from the old metadata-only install.
export async function ensureBuiltinCharacterStored(): Promise<CharacterLibraryEntry> {
  const folderPath = await characterDirPath(BUILTIN_CHARACTER_ID);
  const manifestPath = await characterManifestPath(BUILTIN_CHARACTER_ID);

  let existing: CharacterManifest | null = null;
  if (await pathExists(manifestPath)) {
    existing = await readJson<CharacterManifest>(manifestPath);
  }

  const shouldSeed =
    existing === null || needsModularUpgrade(existing);
  const manifest = shouldSeed
    ? mergeExistingManifest(existing)
    : existing!;

  if (shouldSeed) {
    await ensureDir(folderPath);
    const legacyBundledSprites = await joinPath(folderPath, "sprites", "bundled");
    if (await pathExists(legacyBundledSprites)) {
      await removePath(legacyBundledSprites);
    }
    await writeJson(manifestPath, manifest);
    await seedSprites(folderPath);
  }

  const entry = toLibraryEntry(manifest, folderPath);

  const stored = await readLibraryFile();
  const hasLibraryEntry = stored.some(
    (character) => character.manifest.id === BUILTIN_CHARACTER_ID,
  );
  if (!hasLibraryEntry || shouldSeed) {
    await writeLibraryEntry(entry);
  }

  return entry;
}
