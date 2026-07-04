import {
  ANIMATION_CATEGORIES,
  type AnimationCategory,
  type AnimationDefinition,
  type CharacterManifest,
} from "../types/character";
import type { ShimejiDraft, ShimejiSourceFrame } from "../types/shimejiDraft";
import { getMaxImageSize } from "../utils/frameGeometry";
import { addCharacter, getCharacter, allocateNewTomojiFolderName } from "./characterLibrary";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
} from "./behaviorSettings";
import {
  characterDirPath,
  characterManifestPath,
  characterSourcesDirPath,
  characterSpritesDirPath,
} from "./fs/appPaths";
import {
  copyFile,
  ensureDir,
  getBasename,
  joinPath,
  listDirectory,
  pathExists,
  pickDirectory,
  readBinary,
  removePath,
  renamePath,
  readText,
  toAssetUrl,
  writeBinary,
  writeJson,
} from "./fs/fileSystemAdapter";

const SHIMEJI_TICK_MS = 25;
const DEFAULT_IMPORT_FPS = 8;
const DEFAULT_FRAME_SIZE = 128;
const MAX_AUTO_SCALE = 4;
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
]);

const ACTION_CATEGORY_CANDIDATES: Readonly<
  Partial<Record<AnimationCategory, readonly string[]>>
> = {
  idle: ["Stand"],
  walk: ["Walk", "Run"],
  floorCrawl: ["Creep"],
  sit: ["Sit", "SitAndLookAtMouse"],
  sitAlt: ["SitAndLookUp", "SitAndSpinHeadAction", "Sprawl"],
  sitAlt2: ["SitWithLegsUp", "SitWithLegsDown"],
  sitOnBar: ["SitWithLegsUp", "SitWithLegsDown"],
  dangleOnBar: ["SitAndDangleLegs"],
  fall: ["Falling", "FallWithIe", "Tripping"],
  bounce: ["Bouncing"],
  dragResist: ["Resisting", "Pinched"],
  grabWall: ["GrabWall"],
  climbWall: ["ClimbWall"],
  grabCeiling: ["GrabCeiling"],
  climbCeiling: ["ClimbCeiling"],
  emote: ["SitAndSpinHeadAction"],
  emote2: ["SitAndDangleLegs"],
  emote4: ["ThrowIe"],
  emote5: ["HitIe"],
};

interface ParsedShimejiPose {
  path: string;
  durationTicks: number;
  velocityX: number;
}

interface ParsedShimejiAction {
  name: string;
  poses: ParsedShimejiPose[];
}

interface ShimejiPackage {
  rootDir: string;
  spriteDir: string;
  configDir: string | null;
  sources: ShimejiSourceFrame[];
}

export async function pickShimejiImgFolder(): Promise<string | null> {
  return pickDirectory("Select the Shimeji img folder");
}

export async function pickShimejiFolder(): Promise<string | null> {
  return pickDirectory("Select the Shimeji folder");
}

// lists supported image frames inside a Shimeji img folder, sorted by name.
export async function listShimejiFrames(
  dir: string,
): Promise<ShimejiSourceFrame[]> {
  return listImageFramesRecursive(dir);
}

function imageExtension(pathOrName: string): string | null {
  const match = pathOrName.match(/\.([^./\\]+)$/);
  const extension = match?.[1]?.toLowerCase();

  return extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)
    ? extension
    : null;
}

function isSupportedImageFile(name: string): boolean {
  return imageExtension(name) !== null;
}

async function listCharacterSpriteSources(
  characterId: string,
): Promise<ShimejiSourceFrame[]> {
  const spritesDir = await characterSpritesDirPath(characterId);
  const sourcesDir = await characterSourcesDirPath(characterId);
  const legacySourceDir = await joinPath(spritesDir, "source");

  if (
    !(await pathExists(sourcesDir)) &&
    (await pathExists(legacySourceDir))
  ) {
    await renamePath(legacySourceDir, sourcesDir);
  }

  const searchDir = (await pathExists(sourcesDir)) ? sourcesDir : spritesDir;
  if (!(await pathExists(searchDir))) {
    return [];
  }

  const sources: ShimejiSourceFrame[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await listDirectory(dir);
    for (const entry of entries) {
      if (entry.isDirectory) {
        await walk(entry.path);
        continue;
      }

      if (!isSupportedImageFile(entry.name)) {
        continue;
      }

      sources.push({
        name: entry.name,
        path: entry.path,
        url: toAssetUrl(entry.path),
      });
    }
  }

  await walk(searchDir);

  return sources.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true }),
  );
}

function buildAnimations(
  draft: ShimejiDraft,
  sourcePathByInput: ReadonlyMap<string, string>,
): Partial<Record<AnimationCategory, AnimationDefinition>> {
  const animations: Partial<Record<AnimationCategory, AnimationDefinition>> = {};

  for (const [category, assignment] of Object.entries(draft.assignments) as [
    AnimationCategory,
    ShimejiDraft["assignments"][AnimationCategory],
  ][]) {
    if (assignment.frames.length === 0) {
      continue;
    }

    animations[category] = {
      fps: assignment.fps,
      frames: assignment.frames.map((source, index) => ({
        src: `sprites/${category}/${index}.png`,
        source: sourcePathByInput.get(source),
        durationTicks: assignment.durationTicks?.[index],
      })),
    };
  }

  return animations;
}

async function listImageFramesRecursive(dir: string): Promise<ShimejiSourceFrame[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const sources: ShimejiSourceFrame[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await listDirectory(currentDir);
    for (const entry of entries) {
      if (entry.isDirectory) {
        await walk(entry.path);
        continue;
      }

      if (!isSupportedImageFile(entry.name)) {
        continue;
      }

      sources.push({
        name: entry.name,
        path: entry.path,
        url: toAssetUrl(entry.path),
      });
    }
  }

  await walk(dir);

  return sources.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true }),
  );
}

function isShimejiFrameName(name: string): boolean {
  return /^shime\d+[a-z]*\.[^.]+$/i.test(name) && isSupportedImageFile(name);
}

async function listDirsRecursive(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const dirs: string[] = [dir];

  async function walk(currentDir: string): Promise<void> {
    const entries = await listDirectory(currentDir);
    for (const entry of entries) {
      if (!entry.isDirectory) {
        continue;
      }

      dirs.push(entry.path);
      await walk(entry.path);
    }
  }

  await walk(dir);
  return dirs;
}

async function findBestSpriteDir(rootDir: string): Promise<string> {
  const dirs = await listDirsRecursive(rootDir);
  let bestDir = rootDir;
  let bestScore = -1;

  for (const dir of dirs) {
    const entries = await listDirectory(dir);
    const score = entries.filter(
      (entry) => entry.isFile && isShimejiFrameName(entry.name),
    ).length;

    if (score > bestScore) {
      bestDir = dir;
      bestScore = score;
    }
  }

  return bestDir;
}

async function findConfigDirs(rootDir: string): Promise<string[]> {
  const dirs = await listDirsRecursive(rootDir);
  const configDirs: string[] = [];

  for (const dir of dirs) {
    const actionsPath = await joinPath(dir, "conf", "actions.xml");
    if (await pathExists(actionsPath)) {
      configDirs.push(dir);
    }
  }

  return configDirs;
}

async function findShimejiPackage(inputDir: string): Promise<ShimejiPackage | null> {
  const sources = await listImageFramesRecursive(inputDir);
  const configDirs = await findConfigDirs(inputDir);

  if (configDirs.length > 0) {
    const rootDir = configDirs[0];
    return {
      rootDir,
      configDir: rootDir,
      spriteDir: await findBestSpriteDir(rootDir),
      sources,
    };
  }

  if (sources.some((source) => isShimejiFrameName(source.name))) {
    return {
      rootDir: inputDir,
      configDir: null,
      spriteDir: await findBestSpriteDir(inputDir),
      sources,
    };
  }

  return null;
}

function elementsByName(parent: ParentNode, name: string): Element[] {
  return Array.from(parent.querySelectorAll("*")).filter(
    (element) => element.localName === name,
  );
}

function parseDurationTicks(raw: string | null): number {
  if (raw === null) {
    return Math.round(1000 / DEFAULT_IMPORT_FPS / SHIMEJI_TICK_MS);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.round(1000 / DEFAULT_IMPORT_FPS / SHIMEJI_TICK_MS);
  }

  return Math.round(parsed);
}

function parseVelocityX(raw: string | null): number {
  if (raw === null) {
    return 0;
  }

  const [x] = raw.split(",");
  const parsed = Number(x);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceByBasename(
  sources: readonly ShimejiSourceFrame[],
): ReadonlyMap<string, ShimejiSourceFrame> {
  const map = new Map<string, ShimejiSourceFrame>();
  for (const source of sources) {
    map.set(source.name.toLowerCase(), source);
  }
  return map;
}

async function imagePathFromPose(
  shimeji: ShimejiPackage,
  image: string,
  sourceByName: ReadonlyMap<string, ShimejiSourceFrame>,
): Promise<string | null> {
  const parts = image
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  const candidates = [
    await joinPath(shimeji.spriteDir, ...parts),
    await joinPath(shimeji.rootDir, ...parts),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  const basename = parts[parts.length - 1];
  if (!basename) {
    return null;
  }

  return sourceByName.get(basename.toLowerCase())?.path ?? null;
}

async function parseShimejiActions(
  shimeji: ShimejiPackage,
): Promise<Map<string, ParsedShimejiAction>> {
  if (shimeji.configDir === null) {
    return new Map();
  }

  const actionsPath = await joinPath(shimeji.configDir, "conf", "actions.xml");
  const xml = await readText(actionsPath);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (elementsByName(document, "parsererror").length > 0) {
    throw new Error("actions.xml is not valid XML");
  }

  const actions = new Map<string, ParsedShimejiAction>();
  const sourceByName = sourceByBasename(shimeji.sources);
  for (const actionNode of elementsByName(document, "Action")) {
    const name = actionNode.getAttribute("Name");
    if (!name) {
      continue;
    }

    const poses: ParsedShimejiPose[] = [];
    for (const poseNode of elementsByName(actionNode, "Pose")) {
      const image = poseNode.getAttribute("Image");
      if (!image) {
        continue;
      }

      const path = await imagePathFromPose(shimeji, image, sourceByName);
      if (path === null) {
        continue;
      }

      poses.push({
        path,
        durationTicks: parseDurationTicks(poseNode.getAttribute("Duration")),
        velocityX: parseVelocityX(poseNode.getAttribute("Velocity")),
      });
    }

    if (poses.length > 0) {
      actions.set(name, { name, poses });
    }
  }

  return actions;
}

function averageFps(poses: readonly ParsedShimejiPose[]): number {
  if (poses.length === 0) {
    return DEFAULT_IMPORT_FPS;
  }

  const totalTicks = poses.reduce(
    (total, pose) => total + pose.durationTicks,
    0,
  );
  const averageTicks = Math.max(1, totalTicks / poses.length);
  return Math.max(1, Math.round(1000 / (averageTicks * SHIMEJI_TICK_MS)));
}

function averageWalkSpeed(
  action: ParsedShimejiAction | undefined,
): number {
  if (!action) {
    return 2;
  }

  const velocities = action.poses
    .map((pose) => Math.abs(pose.velocityX))
    .filter((velocity) => velocity > 0);
  if (velocities.length === 0) {
    return 2;
  }

  return velocities.reduce((sum, velocity) => sum + velocity, 0) / velocities.length;
}

async function measureMaxFrameSize(
  framePaths: readonly string[],
): Promise<{ width: number; height: number }> {
  return getMaxImageSize(
    framePaths.map((path) => toAssetUrl(path)),
    { width: DEFAULT_FRAME_SIZE, height: DEFAULT_FRAME_SIZE },
  );
}

function defaultScaleForFrameHeight(frameHeight: number): number {
  if (frameHeight >= DEFAULT_FRAME_SIZE) {
    return 1;
  }

  return Math.min(MAX_AUTO_SCALE, DEFAULT_FRAME_SIZE / frameHeight);
}

function emptyAssignments(): ShimejiDraft["assignments"] {
  return ANIMATION_CATEGORIES.reduce((accumulator, category) => {
    accumulator[category] = { frames: [], fps: DEFAULT_IMPORT_FPS };
    return accumulator;
  }, {} as ShimejiDraft["assignments"]);
}

function assignActionToCategory(
  assignments: ShimejiDraft["assignments"],
  category: AnimationCategory,
  action: ParsedShimejiAction,
): void {
  assignments[category] = {
    frames: action.poses.map((pose) => pose.path),
    fps: averageFps(action.poses),
    durationTicks: action.poses.map((pose) => pose.durationTicks),
  };
}

function poseAtRatio(
  action: ParsedShimejiAction,
  ratio: number,
): ParsedShimejiPose {
  const index = Math.min(
    action.poses.length - 1,
    Math.max(0, Math.round((action.poses.length - 1) * ratio)),
  );
  return action.poses[index];
}

function assignPoseToCategory(
  assignments: ShimejiDraft["assignments"],
  category: AnimationCategory,
  pose: ParsedShimejiPose,
): void {
  assignments[category] = {
    frames: [pose.path],
    fps: DEFAULT_IMPORT_FPS,
    durationTicks: [pose.durationTicks],
  };
}

function assignPinchedDragTiers(
  assignments: ShimejiDraft["assignments"],
  action: ParsedShimejiAction | undefined,
): void {
  if (!action || action.poses.length === 0) {
    return;
  }

  // Shimeji "Pinched" is usually a lean pose strip, not a playback loop.
  // Layout is commonly strong-left -> neutral -> strong-right.
  const light = poseAtRatio(action, 0.5);
  assignPoseToCategory(assignments, "dragLightLeft", light);
  assignPoseToCategory(assignments, "dragLightRight", light);
  assignPoseToCategory(assignments, "dragMildLeft", poseAtRatio(action, 0.2));
  assignPoseToCategory(assignments, "dragStrongLeft", poseAtRatio(action, 0));
  assignPoseToCategory(assignments, "dragMildRight", poseAtRatio(action, 0.8));
  assignPoseToCategory(assignments, "dragStrongRight", poseAtRatio(action, 1));
}

function buildAssignmentsFromActions(
  actions: ReadonlyMap<string, ParsedShimejiAction>,
): ShimejiDraft["assignments"] {
  const assignments = emptyAssignments();

  for (const category of ANIMATION_CATEGORIES) {
    const candidates = ACTION_CATEGORY_CANDIDATES[category] ?? [];
    const action = candidates
      .map((name) => actions.get(name))
      .find((candidate) => candidate !== undefined);

    if (action) {
      assignActionToCategory(assignments, category, action);
    }
  }

  assignPinchedDragTiers(assignments, actions.get("Pinched"));

  return assignments;
}

function framesForClassicNumbers(
  sources: readonly ShimejiSourceFrame[],
  numbers: readonly number[],
): string[] {
  const frames: ShimejiSourceFrame[] = [];

  for (const number of numbers) {
    const pattern = new RegExp(`^shime${number}[a-z]*\\.[^.]+$`, "i");
    frames.push(
      ...sources.filter(
        (source) =>
          pattern.test(source.name) && isSupportedImageFile(source.name),
      ),
    );
  }

  return frames
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((source) => source.path);
}

function assignClassicFrames(
  assignments: ShimejiDraft["assignments"],
  sources: readonly ShimejiSourceFrame[],
  category: AnimationCategory,
  numbers: readonly number[],
): void {
  if (assignments[category].frames.length > 0) {
    return;
  }

  const frames = framesForClassicNumbers(sources, numbers);
  if (frames.length === 0) {
    return;
  }

  assignments[category] = { frames, fps: DEFAULT_IMPORT_FPS };
}

function fillClassicAssignments(
  assignments: ShimejiDraft["assignments"],
  sources: readonly ShimejiSourceFrame[],
): void {
  assignClassicFrames(assignments, sources, "idle", [1]);
  assignClassicFrames(assignments, sources, "walk", [2]);
  assignClassicFrames(assignments, sources, "walk", [1]);
  assignClassicFrames(assignments, sources, "floorCrawl", [20, 21]);
  assignClassicFrames(assignments, sources, "sit", [11]);
  assignClassicFrames(assignments, sources, "sitAlt", [26, 27, 28, 29]);
  assignClassicFrames(assignments, sources, "sitAlt2", [30, 31, 32]);
  assignClassicFrames(assignments, sources, "sitOnBar", [31]);
  assignClassicFrames(assignments, sources, "dangleOnBar", [30, 31, 32, 33]);
  assignClassicFrames(assignments, sources, "fall", [4]);
  assignClassicFrames(assignments, sources, "bounce", [18]);
  assignClassicFrames(assignments, sources, "dragLightLeft", [7]);
  assignClassicFrames(assignments, sources, "dragMildLeft", [8]);
  assignClassicFrames(assignments, sources, "dragStrongLeft", [9]);
  assignClassicFrames(assignments, sources, "dragLightRight", [7]);
  assignClassicFrames(assignments, sources, "dragMildRight", [8]);
  assignClassicFrames(assignments, sources, "dragStrongRight", [10]);
  assignClassicFrames(assignments, sources, "dragResist", [5, 6]);
  assignClassicFrames(assignments, sources, "grabWall", [13]);
  assignClassicFrames(assignments, sources, "grabWall", [12]);
  assignClassicFrames(assignments, sources, "climbWall", [14, 12, 13]);
  assignClassicFrames(assignments, sources, "grabCeiling", [23]);
  assignClassicFrames(assignments, sources, "climbCeiling", [24, 25, 23]);
  assignClassicFrames(assignments, sources, "emote", [26, 27, 28, 29]);
  assignClassicFrames(assignments, sources, "emote2", [30, 31, 32, 33]);
}

export async function buildShimejiDraftFromFolder(
  inputDir: string,
): Promise<ShimejiDraft> {
  const shimeji = await findShimejiPackage(inputDir);
  if (shimeji === null) {
    throw new Error("No Shimeji frames found. Drop the Shimeji root folder, img folder, or character sprite folder.");
  }

  const sources = shimeji.sources.filter((source) =>
    isShimejiFrameName(source.name),
  );
  const actions = await parseShimejiActions(shimeji);
  const assignments = buildAssignmentsFromActions(actions);
  fillClassicAssignments(assignments, sources);

  if (assignments.idle.frames.length === 0 || assignments.walk.frames.length === 0) {
    throw new Error("Could not identify required idle/walk frames from this Shimeji folder.");
  }

  const assignedPaths = assignedFramePaths(assignments);
  const measuredFrame = await measureMaxFrameSize(
    assignedPaths.length > 0
      ? assignedPaths
      : sources.map((source) => source.path),
  );

  return {
    imgDir: shimeji.spriteDir,
    sources,
    assignments,
    name: await getBasename(shimeji.spriteDir),
    dialogueLines: [],
    dialogueFrequency: 0.2,
    behavior: { ...DEFAULT_BEHAVIOR_SETTINGS },
    scale: defaultScaleForFrameHeight(measuredFrame.height),
    speed: averageWalkSpeed(actions.get("Walk")),
    frameWidth: measuredFrame.width,
    frameHeight: measuredFrame.height,
  };
}

export async function convertShimejiFolder(inputDir: string): Promise<string> {
  const draft = await buildShimejiDraftFromFolder(inputDir);
  return convertShimejiDraft(draft);
}

function imageMimeType(pathOrName: string): string {
  const extension = imageExtension(pathOrName);
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  return extension ? `image/${extension}` : "image/png";
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("failed to encode sprite frame"));
        return;
      }

      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, "image/png");
  });
}

async function loadImageBitmap(sourcePath: string): Promise<ImageBitmap> {
  const bytes = await readBinary(sourcePath);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const blob = new Blob([buffer], { type: imageMimeType(sourcePath) });
  return createImageBitmap(blob);
}

function assignedFramePaths(assignments: ShimejiDraft["assignments"]): string[] {
  return Array.from(
    new Set(Object.values(assignments).flatMap((assignment) => assignment.frames)),
  );
}

async function exportFrameSize(
  draft: ShimejiDraft,
): Promise<{ width: number; height: number }> {
  let width = draft.frameWidth;
  let height = draft.frameHeight;

  for (const path of assignedFramePaths(draft.assignments)) {
    try {
      const bitmap = await loadImageBitmap(path);
      width = Math.max(width, bitmap.width);
      height = Math.max(height, bitmap.height);
      bitmap.close();
    } catch {
      // keep draft geometry if a source frame can't be decoded
    }
  }

  return { width, height };
}

async function writeNormalizedSpriteFrame(
  sourcePath: string,
  destPath: string,
  frameWidth: number,
  frameHeight: number,
): Promise<void> {
  const bitmap = await loadImageBitmap(sourcePath);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = frameWidth;
    canvas.height = frameHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2d canvas context unavailable");
    }

    context.imageSmoothingEnabled = false;

    const x = Math.round((frameWidth - bitmap.width) / 2);
    const y = frameHeight - bitmap.height;

    context.clearRect(0, 0, frameWidth, frameHeight);
    context.drawImage(bitmap, x, y);

    await writeBinary(destPath, await canvasToPngBytes(canvas));
  } finally {
    bitmap.close();
  }
}

async function writeDraftSprites(
  characterId: string,
  draft: ShimejiDraft,
): Promise<{
  sourcePathByInput: Map<string, string>;
  frameSize: { width: number; height: number };
}> {
  const destDir = await characterDirPath(characterId);
  const spritesDir = await characterSpritesDirPath(characterId);
  const sourcesDir = await characterSourcesDirPath(characterId);
  const frameSize = await exportFrameSize(draft);
  const transactionId = crypto.randomUUID();
  const spritesStagingDir = `${spritesDir}.${transactionId}.tmp`;
  const spritesBackupDir = `${spritesDir}.${transactionId}.bak`;
  const sourcesStagingDir = `${sourcesDir}.${transactionId}.tmp`;
  const sourcesBackupDir = `${sourcesDir}.${transactionId}.bak`;
  let spritesBackupCreated = false;
  let sourcesBackupCreated = false;
  let spritesInstalled = false;
  let sourcesInstalled = false;

  await ensureDir(destDir);

  try {
    const sourcePaths = [
      ...draft.sources.map((source) => source.path),
      ...Object.values(draft.assignments).flatMap(
        (assignment) => assignment.frames,
      ),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
    const sourcePathByInput = new Map<string, string>();
    const usedSourceFilenames = new Set<string>();
    await ensureDir(sourcesStagingDir);

    for (let index = 0; index < sourcePaths.length; index += 1) {
      const source = sourcePaths[index];
      const basename = await getBasename(source);
      let filename = basename;
      let suffix = index;
      while (usedSourceFilenames.has(filename)) {
        filename = `${suffix.toString().padStart(4, "0")}-${basename}`;
        suffix += 1;
      }
      usedSourceFilenames.add(filename);
      const dest = await joinPath(sourcesStagingDir, filename);
      await copyFile(source, dest);
      sourcePathByInput.set(source, filename);
    }

    for (const [category, assignment] of Object.entries(draft.assignments) as [
      AnimationCategory,
      ShimejiDraft["assignments"][AnimationCategory],
    ][]) {
      if (assignment.frames.length === 0) {
        continue;
      }

      const categoryDir = await joinPath(spritesStagingDir, category);
      await ensureDir(categoryDir);

      for (let index = 0; index < assignment.frames.length; index += 1) {
        const source = assignment.frames[index];
        const dest = await joinPath(categoryDir, `${index}.png`);
        await writeNormalizedSpriteFrame(
          source,
          dest,
          frameSize.width,
          frameSize.height,
        );
      }
    }

    if (await pathExists(spritesDir)) {
      await renamePath(spritesDir, spritesBackupDir);
      spritesBackupCreated = true;
    }
    if (await pathExists(sourcesDir)) {
      await renamePath(sourcesDir, sourcesBackupDir);
      sourcesBackupCreated = true;
    }

    await renamePath(sourcesStagingDir, sourcesDir);
    sourcesInstalled = true;
    await renamePath(spritesStagingDir, spritesDir);
    spritesInstalled = true;
    await Promise.allSettled([
      removePath(spritesBackupDir),
      removePath(sourcesBackupDir),
    ]);
    return { sourcePathByInput, frameSize };
  } catch (error) {
    await removePath(spritesStagingDir);
    await removePath(sourcesStagingDir);

    if (spritesInstalled) {
      await removePath(spritesDir);
    }
    if (spritesBackupCreated && (await pathExists(spritesBackupDir))) {
      await renamePath(spritesBackupDir, spritesDir);
    }
    if (sourcesInstalled) {
      await removePath(sourcesDir);
    }
    if (sourcesBackupCreated && (await pathExists(sourcesBackupDir))) {
      await renamePath(sourcesBackupDir, sourcesDir);
    }

    throw error;
  }
}

// hydrates the frame editor from an existing imported character on disk.
export async function loadCharacterDraft(
  characterId: string,
): Promise<ShimejiDraft> {
  const entry = await getCharacter(characterId);
  if (entry === null) {
    throw new Error("character not found");
  }

  const manifest = entry.manifest;
  const characterDir = await characterDirPath(characterId);
  const sourcesDir = await characterSourcesDirPath(characterId);
  const sources = await listCharacterSpriteSources(characterId);
  const assignments = ANIMATION_CATEGORIES.reduce(
    (accumulator, category) => {
      accumulator[category] = { frames: [], fps: 8 };
      return accumulator;
    },
    {} as ShimejiDraft["assignments"],
  );

  for (const category of ANIMATION_CATEGORIES) {
    const definition = manifest.animations[category];
    if (!definition || definition.frames.length === 0) {
      continue;
    }

    const frames: string[] = [];
    for (const frame of definition.frames) {
      if (frame.source) {
        const sourceFilename = await getBasename(frame.source);
        const sourcePath = await joinPath(sourcesDir, sourceFilename);
        if (await pathExists(sourcePath)) {
          frames.push(sourcePath);
          continue;
        }
      }

      frames.push(await joinPath(characterDir, frame.src));
    }

    assignments[category] = {
      frames,
      fps: definition.fps,
    };
  }

  const frameSize = await measureMaxFrameSize(assignedFramePaths(assignments));

  return {
    imgDir: characterDir,
    sources,
    assignments,
    name: manifest.name,
    dialogueLines: manifest.dialogueSettings.lines,
    dialogueFrequency: manifest.dialogueSettings.frequency,
    behavior: normalizeBehaviorSettings(manifest.behaviorSettings),
    scale: manifest.defaultScale,
    speed: manifest.defaultSpeed,
    frameWidth: Math.max(manifest.frameWidth, frameSize.width),
    frameHeight: Math.max(manifest.frameHeight, frameSize.height),
  };
}

// rewrites sprite files + manifest animations for an existing character.
export async function saveCharacterDraft(
  characterId: string,
  draft: ShimejiDraft,
): Promise<void> {
  const entry = await getCharacter(characterId);
  if (entry === null) {
    throw new Error("character not found");
  }

  const { sourcePathByInput, frameSize } = await writeDraftSprites(
    characterId,
    draft,
  );

  const manifest: CharacterManifest = {
    ...entry.manifest,
    frameWidth: frameSize.width,
    frameHeight: frameSize.height,
    animations: buildAnimations(draft, sourcePathByInput),
  };

  await writeJson(await characterManifestPath(characterId), manifest);
  await addCharacter({ ...entry, manifest });
}

// converts the wizard draft into the Tomoji folder structure: writes normalized
// frames into characters/<id>/sprites/<category>/<n>.png, keeps
// editable originals in characters/<id>/source, and writes a valid manifest.json.
export async function convertShimejiDraft(
  draft: ShimejiDraft,
): Promise<string> {
  const name = draft.name.trim() || "Imported Shimeji";
  const id = await allocateNewTomojiFolderName(name);
  const destDir = await characterDirPath(id);
  await ensureDir(destDir);
  const { sourcePathByInput, frameSize } = await writeDraftSprites(id, draft);

  const manifest: CharacterManifest = {
    id,
    name: id,
    version: "1.0.0",
    author: "Imported (Shimeji)",
    defaultScale: draft.scale,
    defaultSpeed: draft.speed,
    frameWidth: frameSize.width,
    frameHeight: frameSize.height,
    animations: buildAnimations(draft, sourcePathByInput),
    behaviorSettings: normalizeBehaviorSettings(draft.behavior),
    dialogueSettings: {
      lines: draft.dialogueLines,
      frequency: draft.dialogueFrequency,
    },
  };

  await writeJson(await characterManifestPath(id), manifest);
  await addCharacter({ manifest, source: "shimeji", folderPath: destDir });

  return id;
}
