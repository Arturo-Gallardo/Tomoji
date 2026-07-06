import type { CharacterManifest } from "../types/character";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
} from "./behaviorSettings";
import {
  addCharacter,
  allocateNewTomojiFolderName,
} from "./characterLibrary";
import {
  characterDirPath,
  characterManifestPath,
  characterSpritesDirPath,
  characterSourcesDirPath,
} from "./fs/appPaths";
import {
  copyFile,
  ensureDir,
  getBasename,
  getDirname,
  joinPath,
  listDirectory,
  pathExists,
  pickDirectory,
  pickFile,
  readBinary,
  readJson,
  readText,
  writeBinary,
  writeJson,
} from "./fs/fileSystemAdapter";
import type {
  ShimejiActionIntent,
  ShimejiAnimationGraph,
  ShimejiGraphAction,
  ShimejiGraphBehavior,
  ShimejiGraphPose,
  ShimejiImportReport,
  ShimejiMenuAction,
  ShimejiPoint,
} from "../types/shimejiGraph";

const DEFAULT_FRAME_SIZE = 128;
// android packs use large padded mobile canvases; normalize runtime sprites
// so imported pets start near the same desktop size as classic shimejis.
const ANDROID_TARGET_VISIBLE_HEIGHT = 120;
// xml anchors are author data, but some packs put the anchor at the padded
// canvas bottom. clamp only when the gap is obvious.
const VISIBLE_ANCHOR_BOTTOM_CLAMP_THRESHOLD = 30;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);

const ACTION_FILE_NAMES = ["actions.xml", "動作.xml"] as const;
const BEHAVIOR_FILE_NAMES = ["behaviors.xml", "行動.xml"] as const;

export type ShimejiImportFormat = "pc" | "android";

const ACTION_INTENT_CANDIDATES: Record<ShimejiActionIntent, readonly string[]> = {
  idle: ["Stand", "立つ"],
  walk: ["Walk", "歩く", "Run", "走る"],
  floorCrawl: ["Creep", "ずりずり"],
  sit: ["Sit", "座る"],
  sitAlt: ["SitAndLookUp", "座って見上げる", "SitAndLookAtMouse", "座ってマウスを見上げる"],
  sitAlt2: ["Sprawl", "寝そべる", "LieDown", "寝そべってボーっとする"],
  sitOnBar: ["SitWithLegsUp", "楽に座る", "SitWithLegsDown", "足を下ろして座る"],
  dangleOnBar: ["SitAndDangleLegs", "足をぶらぶらさせる", "SitWhileDanglingLegs", "座って足をぶらぶらさせる"],
  fall: ["Fall", "落下する", "Falling", "落ちる", "FallWithIe", "IEを持って落ちる"],
  bounce: ["Bouncing", "跳ねる"],
  dragged: ["Dragged", "ドラッグされる", "Pinched", "つままれる"],
  dragResist: ["Resisting", "抵抗する", "Pinched", "つままれる"],
  grabWall: ["HoldOntoWall", "壁に掴まってボーっとする", "GrabWall", "壁に掴まる"],
  climbWall: ["ClimbWall", "壁を登る", "ClimbAlongWall", "ワークエリアの壁を登る"],
  grabCeiling: ["HoldOntoCeiling", "天井に掴まってボーっとする", "GrabCeiling", "天井に掴まる"],
  climbCeiling: ["ClimbCeiling", "天井を伝う", "ClimbAlongCeiling", "ワークエリアの上辺を伝う"],
};

interface SourceFrame {
  name: string;
  path: string;
}

interface ShimejiPackage {
  format: ShimejiImportFormat;
  rootDir: string;
  spriteDir: string;
  actionsXmlPath: string | null;
  behaviorsXmlPath: string | null;
  sources: SourceFrame[];
  displayName?: string;
}

export interface ShimejiGraphDraft {
  name: string;
  shimeji: ShimejiPackage;
  graph: ShimejiAnimationGraph;
  scale: number;
  speed: number;
  runtimeSpriteScale?: number;
}

export interface ShimejiGraphImportScan {
  status: "ready" | "missingFrames" | "missingActions";
  spriteDir: string | null;
  frameCount: number;
  actionsXmlPath: string | null;
  behaviorsXmlPath: string | null;
  messages: string[];
}

interface ParsedPose {
  image: string;
  sourcePath: string;
  durationTicks: number;
  velocity: { x: number; y: number };
  imageAnchor: ShimejiPoint;
}

interface ParsedAction {
  name: string;
  type: string | null;
  borderType: string | null;
  condition: string | null;
  poses: ParsedPose[];
  references: string[];
}

interface VisibleFrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AndroidManifest {
  name?: string;
  animationSchema?: {
    path?: string;
  };
  sprites?: {
    basePath?: string;
  };
}

interface AndroidAnimationFrame {
  sprite: number;
  dx?: number;
  dy?: number;
  durationTicks?: number;
}

interface AndroidAnimation {
  key: string;
  type?: string;
  subtype?: string;
  direction?: string;
  frames: AndroidAnimationFrame[];
}

interface AndroidAnimationFile {
  animations: AndroidAnimation[];
}

export async function pickShimejiGraphFolder(): Promise<string | null> {
  return pickDirectory("Select the Shimeji folder or img sprite folder");
}

export async function pickShimejiGraphActionsFile(): Promise<string | null> {
  return pickFile("Select actions.xml or 動作.xml", [
    { name: "Shimeji actions XML", extensions: ["xml"] },
  ]);
}

export async function pickShimejiGraphBehaviorsFile(): Promise<string | null> {
  return pickFile("Select behaviors.xml or 行動.xml", [
    { name: "Shimeji behaviors XML", extensions: ["xml"] },
  ]);
}

function isSupportedImageFile(name: string): boolean {
  const extension = name.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase();
  return extension !== undefined && SUPPORTED_IMAGE_EXTENSIONS.has(extension);
}

function isShimejiFrameName(name: string): boolean {
  return /^shime\d+[a-z]*\.[^.]+$/i.test(name) && isSupportedImageFile(name);
}

async function safePathExists(path: string): Promise<boolean> {
  try {
    return await pathExists(path);
  } catch {
    return false;
  }
}

async function safeDirname(path: string): Promise<string | null> {
  try {
    return await getDirname(path);
  } catch {
    return null;
  }
}

async function listDirsRecursive(dir: string): Promise<string[]> {
  if (!(await safePathExists(dir))) {
    return [];
  }

  const dirs = [dir];
  async function walk(currentDir: string): Promise<void> {
    for (const entry of await listDirectory(currentDir)) {
      if (entry.isDirectory) {
        dirs.push(entry.path);
        await walk(entry.path);
      }
    }
  }

  await walk(dir);
  return dirs;
}

async function listImageFramesRecursive(dir: string): Promise<SourceFrame[]> {
  if (!(await safePathExists(dir))) {
    return [];
  }

  const sources: SourceFrame[] = [];
  async function walk(currentDir: string): Promise<void> {
    for (const entry of await listDirectory(currentDir)) {
      if (entry.isDirectory) {
        await walk(entry.path);
        continue;
      }

      if (entry.isFile && isSupportedImageFile(entry.name)) {
        sources.push({ name: entry.name, path: entry.path });
      }
    }
  }

  await walk(dir);
  return sources.sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true }),
  );
}

async function findBestSpriteDir(rootDir: string): Promise<string> {
  let bestDir = rootDir;
  let bestScore = -1;

  for (const dir of await listDirsRecursive(rootDir)) {
    const score = (await listDirectory(dir)).filter(
      (entry) => entry.isFile && isShimejiFrameName(entry.name),
    ).length;

    if (score > bestScore) {
      bestDir = dir;
      bestScore = score;
    }
  }

  return bestDir;
}

async function firstExistingFile(dir: string, names: readonly string[]): Promise<string | null> {
  for (const name of names) {
    const path = await joinPath(dir, name);
    if (await safePathExists(path)) {
      return path;
    }
  }

  return null;
}

async function findConfigRoot(inputDir: string, spriteDir: string): Promise<string | null> {
  for (const dir of await listDirsRecursive(inputDir)) {
    const confDir = await joinPath(dir, "conf");
    if (await firstExistingFile(confDir, ACTION_FILE_NAMES)) {
      return dir;
    }
  }

  let currentDir = spriteDir;
  for (let depth = 0; depth < 8; depth += 1) {
    const confDir = await joinPath(currentDir, "conf");
    if (await firstExistingFile(confDir, ACTION_FILE_NAMES)) {
      return currentDir;
    }

    const parent = await safeDirname(currentDir);
    if (parent === null || parent === currentDir) {
      return null;
    }
    currentDir = parent;
  }

  return null;
}

async function configRootFromXmlFile(path: string): Promise<string> {
  const confDir = await safeDirname(path);
  if (confDir === null || (await getBasename(confDir)).toLowerCase() !== "conf") {
    throw new Error("Choose a Shimeji XML file inside the conf folder.");
  }

  const root = await safeDirname(confDir);
  if (root === null) {
    throw new Error("Choose a Shimeji XML file inside the conf folder.");
  }

  return root;
}

async function findAndroidRoot(inputDir: string): Promise<string | null> {
  const candidates = [inputDir];
  const basename = (await getBasename(inputDir)).toLowerCase();
  if (basename === "sprites") {
    const parent = await safeDirname(inputDir);
    if (parent) {
      candidates.push(parent);
    }
  }

  candidates.push(...(await listDirsRecursive(inputDir)));

  for (const dir of candidates) {
    const manifestPath = await joinPath(dir, "manifest.json");
    if (await safePathExists(manifestPath)) {
      return dir;
    }
  }

  return null;
}

async function findAndroidPackage(inputDir: string): Promise<ShimejiPackage | null> {
  const rootDir = await findAndroidRoot(inputDir);
  if (rootDir === null) {
    return null;
  }

  const manifest = await readJson<AndroidManifest>(await joinPath(rootDir, "manifest.json"));
  const defaultSpriteDir = await joinPath(rootDir, "sprites");
  const spriteDir = manifest.sprites?.basePath
    ? await joinPath(rootDir, manifest.sprites.basePath)
    : defaultSpriteDir;
  const preferredAnimationPath = await joinPath(
    rootDir,
    manifest.animationSchema?.path ?? "animation.json",
  );
  const fallbackAnimationPath = await joinPath(rootDir, "animation.json");
  const animationPath = await safePathExists(preferredAnimationPath)
    ? preferredAnimationPath
    : fallbackAnimationPath;
  if (!(await safePathExists(animationPath))) {
    return null;
  }

  const sources = await listImageFramesRecursive(spriteDir);
  if (sources.length === 0) {
    return null;
  }

  return {
    format: "android",
    rootDir,
    spriteDir,
    actionsXmlPath: animationPath,
    behaviorsXmlPath: null,
    sources,
    displayName: manifest.name,
  };
}

async function findShimejiPackage(
  inputDir: string,
  format: ShimejiImportFormat = "pc",
  actionsXmlPath?: string | null,
  behaviorsXmlPath?: string | null,
): Promise<ShimejiPackage | null> {
  if (format === "android") {
    return findAndroidPackage(inputDir);
  }

  const spriteDir = await findBestSpriteDir(inputDir);
  const sources = await listImageFramesRecursive(spriteDir);
  if (!sources.some((source) => isShimejiFrameName(source.name))) {
    return null;
  }

  const explicitRoot = actionsXmlPath
    ? await configRootFromXmlFile(actionsXmlPath)
    : behaviorsXmlPath
      ? await configRootFromXmlFile(behaviorsXmlPath)
      : null;
  const rootDir = explicitRoot ?? (await findConfigRoot(inputDir, spriteDir)) ?? inputDir;
  const confDir = await joinPath(rootDir, "conf");

  return {
    format: "pc",
    rootDir,
    spriteDir,
    actionsXmlPath: actionsXmlPath ?? (await firstExistingFile(confDir, ACTION_FILE_NAMES)),
    behaviorsXmlPath:
      behaviorsXmlPath ?? (await firstExistingFile(confDir, BEHAVIOR_FILE_NAMES)),
    sources,
  };
}

export async function analyzeShimejiGraphImportSelection(
  inputDir: string,
  format: ShimejiImportFormat = "pc",
  actionsXmlPath?: string | null,
  behaviorsXmlPath?: string | null,
): Promise<ShimejiGraphImportScan> {
  const shimeji = await findShimejiPackage(
    inputDir,
    format,
    actionsXmlPath,
    behaviorsXmlPath,
  );
  const messages: string[] = [];

  if (shimeji === null) {
    return {
      status: "missingFrames",
      spriteDir: null,
      frameCount: 0,
      actionsXmlPath: null,
      behaviorsXmlPath: null,
      messages: [
        format === "android"
          ? "No Android Shimeji manifest/animation/sprites found. Choose the folder with manifest.json, animation.json, and sprites."
          : "No shime*.png frames found. Choose the character img folder or full Shimeji folder.",
      ],
    };
  }

  const frameCount =
    format === "android"
      ? shimeji.sources.length
      : shimeji.sources.filter((source) => isShimejiFrameName(source.name)).length;
  messages.push(`Found ${frameCount} sprite frame(s) in ${shimeji.spriteDir}.`);

  if (format === "android") {
    messages.push(`Found Android animation JSON at ${shimeji.actionsXmlPath}.`);
    return {
      status: "ready",
      spriteDir: shimeji.spriteDir,
      frameCount,
      actionsXmlPath: shimeji.actionsXmlPath,
      behaviorsXmlPath: null,
      messages,
    };
  }

  if (shimeji.actionsXmlPath) {
    messages.push(`Found actions XML at ${shimeji.actionsXmlPath}.`);
  } else {
    messages.push("No actions.xml/動作.xml found. Graph import needs this file.");
  }

  if (shimeji.behaviorsXmlPath) {
    messages.push(`Found behaviors XML at ${shimeji.behaviorsXmlPath}.`);
  } else {
    messages.push("No behaviors.xml/行動.xml found. Import can continue with action playback only.");
  }

  return {
    status: shimeji.actionsXmlPath ? "ready" : "missingActions",
    spriteDir: shimeji.spriteDir,
    frameCount,
    actionsXmlPath: shimeji.actionsXmlPath,
    behaviorsXmlPath: shimeji.behaviorsXmlPath,
    messages,
  };
}

function elementsByNames(parent: ParentNode, names: readonly string[]): Element[] {
  return Array.from(parent.querySelectorAll("*")).filter((element) =>
    names.includes(element.localName),
  );
}

function childElementsByNames(parent: Element, names: readonly string[]): Element[] {
  return Array.from(parent.children).filter((element) =>
    names.includes(element.localName),
  );
}

function attr(element: Element, names: readonly string[]): string | null {
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function parsePoint(raw: string | null, fallback: ShimejiPoint): ShimejiPoint {
  if (raw === null) {
    return fallback;
  }

  const [x, y] = raw.split(",").map((part) => Number(part.trim()));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
}

function parseDurationTicks(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 6;
}

function parseFrequency(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceByBasename(sources: readonly SourceFrame[]): ReadonlyMap<string, SourceFrame> {
  const map = new Map<string, SourceFrame>();
  for (const source of sources) {
    map.set(source.name.toLowerCase(), source);
  }
  return map;
}

async function imagePathFromPose(
  shimeji: ShimejiPackage,
  image: string,
  sourceByName: ReadonlyMap<string, SourceFrame>,
): Promise<string | null> {
  const parts = image.replace(/\\/g, "/").split("/").filter(Boolean);
  const candidates = [
    await joinPath(shimeji.spriteDir, ...parts),
    await joinPath(shimeji.rootDir, ...parts),
  ];

  for (const candidate of candidates) {
    if (await safePathExists(candidate)) {
      return candidate;
    }
  }

  const basename = parts[parts.length - 1];
  return basename ? sourceByName.get(basename.toLowerCase())?.path ?? null : null;
}

async function parseActions(
  shimeji: ShimejiPackage,
  report: ShimejiImportReport,
): Promise<Map<string, ParsedAction>> {
  if (shimeji.actionsXmlPath === null) {
    throw new Error("actions.xml/動作.xml is required for Shimeji graph import.");
  }

  const document = new DOMParser().parseFromString(
    await readText(shimeji.actionsXmlPath),
    "application/xml",
  );
  if (elementsByNames(document, ["parsererror"]).length > 0) {
    throw new Error("Shimeji actions XML is not valid XML.");
  }

  const sourceByName = sourceByBasename(shimeji.sources);
  const visibleBoundsByPath = new Map<string, VisibleFrameBounds>();
  const actions = new Map<string, ParsedAction>();

  for (const node of elementsByNames(document, ["Action", "動作"])) {
    const name = attr(node, ["Name", "名前"]);
    if (!name) {
      continue;
    }

    const poses: ParsedPose[] = [];
    for (const poseNode of elementsByNames(node, ["Pose", "ポーズ"])) {
      const image = attr(poseNode, ["Image", "画像"]);
      if (!image) {
        continue;
      }

      const sourcePath = await imagePathFromPose(shimeji, image, sourceByName);
      if (sourcePath === null) {
        report.missingImages.push(image);
        continue;
      }

      const xmlImageAnchor = parsePoint(attr(poseNode, ["ImageAnchor", "基準座標"]), {
        x: DEFAULT_FRAME_SIZE / 2,
        y: DEFAULT_FRAME_SIZE,
      });

      poses.push({
        image,
        sourcePath,
        durationTicks: parseDurationTicks(attr(poseNode, ["Duration", "長さ"])),
        velocity: parsePoint(attr(poseNode, ["Velocity", "移動速度"]), { x: 0, y: 0 }),
        imageAnchor: await clampAnchorToVisibleBottom(
          sourcePath,
          xmlImageAnchor,
          visibleBoundsByPath,
        ),
      });
    }

    actions.set(name, {
      name,
      type: attr(node, ["Type", "種類"]),
      borderType: attr(node, ["BorderType", "枠"]),
      condition: attr(node, ["Condition", "条件"]),
      poses,
      references: childElementsByNames(node, ["ActionReference", "動作参照"])
        .map((refNode) => attr(refNode, ["Name", "名前"]))
        .filter((refName): refName is string => refName !== null),
    });
  }

  report.actionsParsed = actions.size;
  report.posesParsed = Array.from(actions.values()).reduce(
    (total, action) => total + action.poses.length,
    0,
  );

  return actions;
}

async function parseBehaviors(
  shimeji: ShimejiPackage,
  report: ShimejiImportReport,
): Promise<Record<string, ShimejiGraphBehavior>> {
  if (shimeji.behaviorsXmlPath === null) {
    return {};
  }

  const document = new DOMParser().parseFromString(
    await readText(shimeji.behaviorsXmlPath),
    "application/xml",
  );
  if (elementsByNames(document, ["parsererror"]).length > 0) {
    throw new Error("Shimeji behaviors XML is not valid XML.");
  }

  const behaviors: Record<string, ShimejiGraphBehavior> = {};
  for (const node of elementsByNames(document, ["Behavior", "行動"])) {
    const name = attr(node, ["Name", "名前"]);
    if (!name) {
      continue;
    }

    behaviors[name] = {
      name,
      hidden: attr(node, ["Hidden", "隠す"]) === "true",
      frequency: parseFrequency(attr(node, ["Frequency", "頻度"])),
      condition: attr(node, ["Condition", "条件"]),
      nextBehaviors: elementsByNames(node, ["BehaviorReference", "行動参照"]).map(
        (refNode) => ({
          name: attr(refNode, ["Name", "名前"]) ?? "",
          frequency: parseFrequency(attr(refNode, ["Frequency", "頻度"])),
          condition: attr(refNode, ["Condition", "条件"]),
        }),
      ).filter((ref) => ref.name.length > 0),
    };
  }

  report.behaviorsParsed = Object.keys(behaviors).length;
  return behaviors;
}

function actionExists(
  actions: ReadonlyMap<string, ParsedAction>,
  name: string,
): boolean {
  const action = actions.get(name);
  return action !== undefined && (action.poses.length > 0 || action.references.length > 0);
}

function defaultActionMatchesIntent(
  intent: ShimejiActionIntent,
  actionName: string,
  actions: ReadonlyMap<string, ParsedAction>,
): boolean {
  if (!actionExists(actions, actionName)) {
    return false;
  }

  // some packs use the standard dangle action name for a long custom emote.
  // real leg-dangle loops are normally short; skip obvious emote-length loops.
  if (intent === "dangleOnBar") {
    return flattenAction(actionName, actions).length <= 12;
  }

  return true;
}

function buildDefaultActions(
  actions: ReadonlyMap<string, ParsedAction>,
): Partial<Record<ShimejiActionIntent, string>> {
  const defaults: Partial<Record<ShimejiActionIntent, string>> = {};

  for (const [intent, candidates] of Object.entries(ACTION_INTENT_CANDIDATES) as [
    ShimejiActionIntent,
    readonly string[],
  ][]) {
    const match = candidates.find((name) =>
      defaultActionMatchesIntent(intent, name, actions),
    );
    if (match) {
      defaults[intent] = match;
    }
  }

  return defaults;
}

function actionSignature(action: ParsedAction): string {
  return action.poses.map((pose) => pose.sourcePath).join("|");
}

function referencedActionNames(
  action: ParsedAction,
  actions: ReadonlyMap<string, ParsedAction>,
  seen: ReadonlySet<string> = new Set(),
): string[] {
  if (seen.has(action.name)) {
    return [];
  }

  const nextSeen = new Set(seen);
  nextSeen.add(action.name);

  return [
    action.name,
    ...action.references.flatMap((reference) => {
      const referenced = actions.get(reference);
      return referenced
        ? referencedActionNames(referenced, actions, nextSeen)
        : [reference];
    }),
  ];
}

function buildMenuActions(
  actions: ReadonlyMap<string, ParsedAction>,
  defaults: Partial<Record<ShimejiActionIntent, string>>,
): ShimejiMenuAction[] {
  const safeExpression =
    /face|look|spin|dance|wave|laugh|smile|emote|head|blink|wink|happy|sad|angry|surprise|mouse|顔|見る|見上げ|首|回|笑|踊|手|マウス/i;
  const blocked =
    /walk|run|dash|climb|crawl|creep|fall|fallen|jump|throw|pull|divide|split|drag|pinch|resist|grab|hold|standup|stand up|get up|getting up|trip|tripping|bounce|landing|land|wall|ceiling|ie|壁|天井|落|投|分裂|引っこ|走|歩|登|掴|ドラッグ|抵抗|ジャンプ|転ぶ|跳ね|立ち上|起き/i;
  const usedSignatures = new Set<string>();
  const defaultsToSkip = new Set(Object.values(defaults).filter(Boolean));
  const menu: ShimejiMenuAction[] = [];

  for (const action of actions.values()) {
    if (
      menu.length >= 6 ||
      defaultsToSkip.has(action.name) ||
      referencedActionNames(action, actions).some((name) => blocked.test(name)) ||
      !safeExpression.test(action.name)
    ) {
      continue;
    }

    const flattened = action.poses.length > 0 ? action : null;
    if (flattened === null || flattened.poses.length <= 1) {
      continue;
    }

    const signature = actionSignature(flattened);
    if (usedSignatures.has(signature)) {
      continue;
    }

    usedSignatures.add(signature);
    menu.push({ actionName: action.name, label: action.name });
  }

  return menu;
}

function safeFilename(input: string): string {
  const cleaned = input.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : crypto.randomUUID();
}

function imageMimeType(pathOrName: string): string {
  const extension = pathOrName.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase();
  return extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension
      ? `image/${extension}`
      : "image/png";
}

async function loadImageBitmap(sourcePath: string): Promise<ImageBitmap> {
  const bytes = await readBinary(sourcePath);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return createImageBitmap(new Blob([buffer], { type: imageMimeType(sourcePath) }));
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("failed to encode sprite frame"));
        return;
      }

      blob.arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, "image/png");
  });
}

async function buildCanvasMetrics(
  poses: readonly ParsedPose[],
): Promise<{
  width: number;
  height: number;
  anchor: ShimejiPoint;
}> {
  let width = DEFAULT_FRAME_SIZE;
  let height = DEFAULT_FRAME_SIZE;
  const bitmaps = new Map<string, { width: number; height: number }>();

  for (const pose of poses) {
    if (!bitmaps.has(pose.sourcePath)) {
      const bitmap = await loadImageBitmap(pose.sourcePath);
      try {
        const bounds = bitmapContentBounds(bitmap);
        bitmaps.set(pose.sourcePath, {
          width: bounds.width,
          height: bounds.height,
        });
      } finally {
        bitmap.close();
      }
    }

    const size = bitmaps.get(pose.sourcePath);
    if (!size) {
      continue;
    }

    width = Math.max(width, size.width);
    height = Math.max(height, size.height);
  }

  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    anchor: {
      x: Math.ceil(width / 2),
      y: Math.ceil(height),
    },
  };
}

function scaleCanvasMetrics(
  canvas: {
    width: number;
    height: number;
    anchor: ShimejiPoint;
  },
  scale: number,
): {
  width: number;
  height: number;
  anchor: ShimejiPoint;
} {
  if (scale >= 1) {
    return canvas;
  }

  return {
    width: Math.max(1, Math.ceil(canvas.width * scale)),
    height: Math.max(1, Math.ceil(canvas.height * scale)),
    anchor: {
      x: Math.max(1, Math.ceil(canvas.anchor.x * scale)),
      y: Math.max(1, Math.ceil(canvas.anchor.y * scale)),
    },
  };
}

function androidRuntimeSpriteScale(canvasHeight: number): number {
  if (canvasHeight <= ANDROID_TARGET_VISIBLE_HEIGHT) {
    return 1;
  }

  return Math.max(0.25, ANDROID_TARGET_VISIBLE_HEIGHT / canvasHeight);
}

function bitmapContentBounds(bitmap: ImageBitmap): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return bitmapVisibleBounds(bitmap) ?? {
    x: 0,
    y: 0,
    width: bitmap.width,
    height: bitmap.height,
  };
}

function bitmapVisibleBounds(bitmap: ImageBitmap): VisibleFrameBounds | null {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }

  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  let minX = bitmap.width;
  let minY = bitmap.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (data[(y * bitmap.width + x) * 4 + 3] === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function writeNormalizedFrame(
  sourcePath: string,
  destPath: string,
  imageAnchor: ShimejiPoint,
  canvasAnchor: ShimejiPoint,
  width: number,
  height: number,
  renderScale = 1,
): Promise<void> {
  const bitmap = await loadImageBitmap(sourcePath);
  try {
    const bounds = bitmapContentBounds(bitmap);
    const targetWidth = Math.max(1, Math.round(bounds.width * renderScale));
    const targetHeight = Math.max(1, Math.round(bounds.height * renderScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2d canvas context unavailable");
    }

    context.imageSmoothingEnabled = renderScale < 1;
    if (renderScale < 1) {
      context.imageSmoothingQuality = "high";
    }
    context.clearRect(0, 0, width, height);
    const adjustedAnchor = {
      x: (imageAnchor.x - bounds.x) * renderScale,
      y: (imageAnchor.y - bounds.y) * renderScale,
    };
    const x = Math.min(
      Math.max(0, Math.round(canvasAnchor.x - adjustedAnchor.x)),
      Math.max(0, width - targetWidth),
    );
    const y = Math.min(
      Math.max(0, Math.round(canvasAnchor.y - adjustedAnchor.y)),
      Math.max(0, height - targetHeight),
    );
    context.drawImage(
      bitmap,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      x,
      y,
      targetWidth,
      targetHeight,
    );
    await writeBinary(destPath, await canvasToPngBytes(canvas));
  } finally {
    bitmap.close();
  }
}

async function defaultShimejiName(shimeji: ShimejiPackage): Promise<string> {
  if (shimeji.displayName?.trim()) {
    return shimeji.displayName.trim();
  }

  const spriteName = await getBasename(shimeji.spriteDir);
  if (spriteName.toLowerCase() !== "img" && spriteName.toLowerCase() !== "shimeji") {
    return spriteName;
  }

  const parentDir = await safeDirname(shimeji.spriteDir);
  return parentDir ? getBasename(parentDir) : spriteName;
}

function averageWalkSpeed(actions: ReadonlyMap<string, ParsedAction>): number {
  const walk = actions.get("Walk") ?? actions.get("歩く");
  const velocities = (walk?.poses ?? [])
    .map((pose) => Math.abs(pose.velocity.x))
    .filter((velocity) => velocity > 0);

  if (velocities.length === 0) {
    return 2;
  }

  return velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length;
}

function spriteIndexFromName(name: string): number | null {
  const match = name.match(/^(\d+)/);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  return Number.isInteger(index) ? index : null;
}

function sourceBySpriteIndex(sources: readonly SourceFrame[]): ReadonlyMap<number, SourceFrame> {
  const map = new Map<number, SourceFrame>();
  for (const source of sources) {
    const index = spriteIndexFromName(source.name);
    if (index !== null && !map.has(index)) {
      map.set(index, source);
    }
  }
  return map;
}

function firstAndroidAction(
  actions: ReadonlyMap<string, ParsedAction>,
  subtypes: readonly string[],
  directions: readonly string[] = ["LEFT", "ANY", "RIGHT"],
): string | undefined {
  for (const direction of directions) {
    for (const action of actions.values()) {
      if (
        action.poses.length > 0 &&
        action.type !== null &&
        subtypes.includes(action.type.toUpperCase()) &&
        (action.condition ?? "ANY").toUpperCase() === direction
      ) {
        return action.name;
      }
    }
  }

  return undefined;
}

function buildAndroidDefaultActions(
  actions: ReadonlyMap<string, ParsedAction>,
): Partial<Record<ShimejiActionIntent, string>> {
  const defaults: Partial<Record<ShimejiActionIntent, string>> = {
    idle: firstAndroidAction(actions, ["STAND"]),
    walk: firstAndroidAction(actions, ["WALK"]),
    floorCrawl: firstAndroidAction(actions, ["CREEP"]),
    sit: firstAndroidAction(actions, ["SIT", "SLEEP"]),
    sitAlt: firstAndroidAction(actions, ["SIT_LOOK_UP", "LOOK_UP"]),
    sitAlt2: firstAndroidAction(actions, ["STRETCH"]),
    sitOnBar: firstAndroidAction(actions, ["SIT_DOWN"]),
    dangleOnBar: firstAndroidAction(actions, ["IDLE_DANGLE_LEGS"]),
    fall: firstAndroidAction(actions, ["FALL"], ["ANY", "LEFT", "RIGHT"]),
    bounce: firstAndroidAction(actions, ["BOUNCE"]),
    dragged: firstAndroidAction(actions, ["DRAG"], ["ANY", "LEFT", "RIGHT"]),
    dragResist: firstAndroidAction(actions, ["DRAG"], ["ANY", "LEFT", "RIGHT"]),
    grabWall: firstAndroidAction(actions, ["CLIMB"]),
    climbWall: firstAndroidAction(actions, ["CLIMB"]),
    grabCeiling: firstAndroidAction(actions, ["HANG"]),
    climbCeiling: firstAndroidAction(actions, ["HANG"]),
  };

  return Object.fromEntries(
    Object.entries(defaults).filter((entry): entry is [ShimejiActionIntent, string] =>
      typeof entry[1] === "string",
    ),
  );
}

function buildAndroidMenuActions(
  actions: ReadonlyMap<string, ParsedAction>,
  defaults: Partial<Record<ShimejiActionIntent, string>>,
): ShimejiMenuAction[] {
  const blockedSubtypes = new Set([
    "BOUNCE",
    "CLIMB",
    "CREEP",
    "DESCEND",
    "DRAG",
    "FALL",
    "FLING",
    "JUMP",
    "JUMP_DOWN",
    "JUMP_UP",
    "STAND",
    "WALK",
  ]);
  const defaultsToSkip = new Set(Object.values(defaults).filter(Boolean));
  const menu: ShimejiMenuAction[] = [];

  for (const action of actions.values()) {
    const subtype = action.type?.toUpperCase();
    if (
      menu.length >= 6 ||
      action.poses.length === 0 ||
      defaultsToSkip.has(action.name) ||
      (subtype !== undefined && blockedSubtypes.has(subtype))
    ) {
      continue;
    }

    menu.push({ actionName: action.name, label: action.name.replace(/_/g, " ") });
  }

  return menu;
}

function averageAndroidWalkSpeed(
  actions: ReadonlyMap<string, ParsedAction>,
  defaults: Partial<Record<ShimejiActionIntent, string>>,
): number {
  const walk = defaults.walk ? actions.get(defaults.walk) : undefined;
  const velocities = (walk?.poses ?? [])
    .map((pose) => Math.abs(pose.velocity.x))
    .filter((velocity) => velocity > 0);

  if (velocities.length === 0) {
    return 2;
  }

  return velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length;
}

async function sourceVisibleBounds(sourcePath: string): Promise<VisibleFrameBounds> {
  const bitmap = await loadImageBitmap(sourcePath);
  try {
    return bitmapContentBounds(bitmap);
  } finally {
    bitmap.close();
  }
}

async function androidSourceVisibleAnchor(
  sourcePath: string,
): Promise<ShimejiPoint | null> {
  const bitmap = await loadImageBitmap(sourcePath);
  try {
    const bounds = bitmapVisibleBounds(bitmap);
    return bounds
      ? {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height,
        }
      : null;
  } finally {
    bitmap.close();
  }
}

async function clampAnchorToVisibleBottom(
  sourcePath: string,
  imageAnchor: ShimejiPoint,
  visibleBoundsByPath: Map<string, VisibleFrameBounds>,
): Promise<ShimejiPoint> {
  if (!visibleBoundsByPath.has(sourcePath)) {
    visibleBoundsByPath.set(sourcePath, await sourceVisibleBounds(sourcePath));
  }

  const bounds = visibleBoundsByPath.get(sourcePath);
  if (!bounds) {
    return imageAnchor;
  }

  const visibleBottom = bounds.y + bounds.height;
  if (imageAnchor.y <= visibleBottom + VISIBLE_ANCHOR_BOTTOM_CLAMP_THRESHOLD) {
    return imageAnchor;
  }

  return {
    x: imageAnchor.x,
    y: visibleBottom,
  };
}

async function buildAndroidParsedActions(
  shimeji: ShimejiPackage,
  animationFile: AndroidAnimationFile,
  report: ShimejiImportReport,
): Promise<Map<string, ParsedAction>> {
  if (!Array.isArray(animationFile.animations)) {
    throw new Error("Android animation.json is missing animations.");
  }

  const sourceByIndex = sourceBySpriteIndex(shimeji.sources);
  const anchorBySourcePath = new Map<string, ShimejiPoint | null>();
  const transparentImages = new Set<string>();
  const actions = new Map<string, ParsedAction>();

  for (const animation of animationFile.animations) {
    if (!animation.key || !Array.isArray(animation.frames)) {
      continue;
    }

    const poses: ParsedPose[] = [];
    for (const frame of animation.frames) {
      const source = sourceByIndex.get(frame.sprite);
      if (!source) {
        report.missingImages.push(String(frame.sprite));
        continue;
      }

      if (!anchorBySourcePath.has(source.path)) {
        anchorBySourcePath.set(
          source.path,
          await androidSourceVisibleAnchor(source.path),
        );
      }
      const imageAnchor = anchorBySourcePath.get(source.path);
      if (!imageAnchor) {
        transparentImages.add(source.name);
        continue;
      }

      poses.push({
        image: source.name,
        sourcePath: source.path,
        durationTicks: parseDurationTicks(
          frame.durationTicks === undefined ? null : String(frame.durationTicks),
        ),
        velocity: {
          x: typeof frame.dx === "number" && Number.isFinite(frame.dx)
            ? frame.dx
            : 0,
          y: typeof frame.dy === "number" && Number.isFinite(frame.dy)
            ? frame.dy
            : 0,
        },
        imageAnchor,
      });
    }

    actions.set(animation.key, {
      name: animation.key,
      type: animation.subtype ?? null,
      borderType: animation.type ?? null,
      condition: animation.direction ?? null,
      poses,
      references: [],
    });
  }

  report.actionsParsed = actions.size;
  report.posesParsed = Array.from(actions.values()).reduce(
    (total, action) => total + action.poses.length,
    0,
  );
  if (transparentImages.size > 0) {
    report.issues.push({
      severity: "warning",
      message: `Ignored ${transparentImages.size} fully transparent Android sprite frame(s).`,
    });
  }

  return actions;
}

function flattenAction(
  name: string,
  actions: ReadonlyMap<string, ParsedAction>,
  seen: ReadonlySet<string> = new Set(),
): ParsedPose[] {
  const action = actions.get(name);
  if (!action || seen.has(name)) {
    return [];
  }

  if (action.poses.length > 0) {
    return action.poses;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(name);
  return action.references.flatMap((reference) =>
    flattenAction(reference, actions, nextSeen),
  );
}

function buildGraphActions(
  parsedActions: ReadonlyMap<string, ParsedAction>,
): Record<string, ShimejiGraphAction> {
  const graphActions: Record<string, ShimejiGraphAction> = {};
  for (const action of parsedActions.values()) {
    graphActions[action.name] = {
      name: action.name,
      type: action.type,
      borderType: action.borderType,
      condition: action.condition,
      poses: action.poses.map((pose): ShimejiGraphPose => ({
        src: "",
        source: pose.sourcePath,
        durationTicks: pose.durationTicks,
        velocity: pose.velocity,
        imageAnchor: pose.imageAnchor,
      })),
      references: action.references.map((name) => ({ name })),
    };
  }

  return graphActions;
}

async function buildAndroidGraphDraftFromFolder(
  inputDir: string,
): Promise<ShimejiGraphDraft> {
  const shimeji = await findAndroidPackage(inputDir);
  if (shimeji === null || shimeji.actionsXmlPath === null) {
    throw new Error("No Android Shimeji package found. Choose the folder with manifest.json, animation.json, and sprites.");
  }

  const manifest = await readJson<AndroidManifest>(await joinPath(shimeji.rootDir, "manifest.json"));
  const animationFile = await readJson<AndroidAnimationFile>(shimeji.actionsXmlPath);
  const report: ShimejiImportReport = {
    actionsParsed: 0,
    behaviorsParsed: 0,
    posesParsed: 0,
    missingImages: [],
    unsupportedActions: [],
    issues: [],
  };

  const parsedActions = await buildAndroidParsedActions(
    shimeji,
    animationFile,
    report,
  );
  const defaultActions = buildAndroidDefaultActions(parsedActions);
  const menuActions = buildAndroidMenuActions(parsedActions, defaultActions);
  const allUsedPoses = Array.from(new Set([
    ...Object.values(defaultActions).filter((name): name is string => Boolean(name))
      .flatMap((name) => flattenAction(name, parsedActions)),
    ...menuActions.flatMap((item) => flattenAction(item.actionName, parsedActions)),
  ]));
  const rawCanvas = await buildCanvasMetrics(
    allUsedPoses.length > 0
      ? allUsedPoses
      : Array.from(parsedActions.values()).flatMap((action) => action.poses),
  );
  const runtimeSpriteScale = androidRuntimeSpriteScale(rawCanvas.height);
  const canvas = scaleCanvasMetrics(rawCanvas, runtimeSpriteScale);

  if (report.missingImages.length > 0) {
    report.issues.push({
      severity: "warning",
      message: `${report.missingImages.length} Android sprite reference(s) could not be found.`,
    });
  }
  if (runtimeSpriteScale < 1) {
    report.issues.push({
      severity: "info",
      message: `Android sprites were normalized from ${rawCanvas.height}px to about ${canvas.height}px tall so this Tomoji starts at desktop size.`,
    });
  }

  return {
    name: manifest.name ?? await defaultShimejiName(shimeji),
    shimeji,
    graph: {
      actions: buildGraphActions(parsedActions),
      behaviors: {},
      defaultActions,
      menuActions,
      spriteCanvas: canvas,
      importReport: report,
    },
    scale: 1,
    speed: averageAndroidWalkSpeed(parsedActions, defaultActions),
    runtimeSpriteScale,
  };
}

export async function buildShimejiGraphDraftFromFolder(
  inputDir: string,
  format: ShimejiImportFormat = "pc",
  actionsXmlPath?: string | null,
  behaviorsXmlPath?: string | null,
): Promise<ShimejiGraphDraft> {
  if (format === "android") {
    return buildAndroidGraphDraftFromFolder(inputDir);
  }

  const shimeji = await findShimejiPackage(
    inputDir,
    format,
    actionsXmlPath,
    behaviorsXmlPath,
  );
  if (shimeji === null) {
    throw new Error("No Shimeji frames found. Choose the full Shimeji folder or img character folder.");
  }

  const report: ShimejiImportReport = {
    actionsParsed: 0,
    behaviorsParsed: 0,
    posesParsed: 0,
    missingImages: [],
    unsupportedActions: [],
    issues: [],
  };
  const parsedActions = await parseActions(shimeji, report);
  const behaviors = await parseBehaviors(shimeji, report);
  const defaultActions = buildDefaultActions(parsedActions);
  const menuActions = buildMenuActions(parsedActions, defaultActions);
  const allUsedPoses = Array.from(new Set([
    ...Object.values(defaultActions).filter((name): name is string => Boolean(name))
      .flatMap((name) => flattenAction(name, parsedActions)),
    ...menuActions.flatMap((item) => flattenAction(item.actionName, parsedActions)),
  ]));
  const canvas = await buildCanvasMetrics(
    allUsedPoses.length > 0
      ? allUsedPoses
      : Array.from(parsedActions.values()).flatMap((action) => action.poses),
  );

  for (const action of parsedActions.values()) {
    if (action.type === "Embedded" || action.type === "組み込み") {
      report.unsupportedActions.push(action.name);
    }
  }

  if (report.missingImages.length > 0) {
    report.issues.push({
      severity: "warning",
      message: `${report.missingImages.length} pose image reference(s) could not be found.`,
    });
  }
  if (report.unsupportedActions.length > 0) {
    report.issues.push({
      severity: "info",
      message: `${report.unsupportedActions.length} embedded Shimeji action(s) imported as visual/no-op fallbacks.`,
    });
  }

  return {
    name: await defaultShimejiName(shimeji),
    shimeji,
    graph: {
      actions: buildGraphActions(parsedActions),
      behaviors,
      defaultActions,
      menuActions,
      spriteCanvas: canvas,
      importReport: report,
    },
    scale: 1,
    speed: averageWalkSpeed(parsedActions),
  };
}

async function writeGraphSprites(
  characterId: string,
  draft: ShimejiGraphDraft,
): Promise<ShimejiAnimationGraph> {
  const spritesDir = await characterSpritesDirPath(characterId);
  const sourcesDir = await characterSourcesDirPath(characterId);
  const shimejiSpriteDir = await joinPath(spritesDir, "shimeji");
  await ensureDir(shimejiSpriteDir);
  await ensureDir(sourcesDir);

  const sourceToRuntime = new Map<string, string>();
  const sourceToOriginal = new Map<string, string>();
  const usedNames = new Set<string>();
  const poses = Object.values(draft.graph.actions).flatMap((action) => action.poses);
  const renderScale = draft.runtimeSpriteScale ?? 1;

  for (let index = 0; index < poses.length; index += 1) {
    const pose = poses[index];
    if (!pose.source || sourceToRuntime.has(pose.source)) {
      continue;
    }

    const basename = await getBasename(pose.source);
    const safeBase = safeFilename(basename).replace(/\.[^.]+$/, "");
    let filename = `${safeBase}.png`;
    let suffix = 1;
    while (usedNames.has(filename)) {
      filename = `${safeBase}-${suffix}.png`;
      suffix += 1;
    }
    usedNames.add(filename);

    const runtimePath = await joinPath(shimejiSpriteDir, filename);
    await writeNormalizedFrame(
      pose.source,
      runtimePath,
      pose.imageAnchor,
      draft.graph.spriteCanvas.anchor,
      draft.graph.spriteCanvas.width,
      draft.graph.spriteCanvas.height,
      renderScale,
    );
    sourceToRuntime.set(pose.source, `sprites/shimeji/${filename}`);

    const sourceDest = await joinPath(sourcesDir, basename);
    await copyFile(pose.source, sourceDest);
    sourceToOriginal.set(pose.source, basename);
  }

  const actions = Object.fromEntries(
    Object.entries(draft.graph.actions).map(([name, action]) => [
      name,
      {
        ...action,
        poses: action.poses.map((pose) => ({
          ...pose,
          src: pose.source ? sourceToRuntime.get(pose.source) ?? pose.src : pose.src,
          source: pose.source ? sourceToOriginal.get(pose.source) : undefined,
          imageAnchor:
            renderScale < 1
              ? {
                  x: pose.imageAnchor.x * renderScale,
                  y: pose.imageAnchor.y * renderScale,
                }
              : pose.imageAnchor,
        })),
      },
    ]),
  );

  return { ...draft.graph, actions };
}

export async function convertShimejiGraphDraft(
  draft: ShimejiGraphDraft,
  nameOverride?: string,
): Promise<string> {
  const name = (nameOverride ?? draft.name).trim() || "Imported Shimeji";
  const id = await allocateNewTomojiFolderName(name);
  const destDir = await characterDirPath(id);
  await ensureDir(destDir);

  const graph = await writeGraphSprites(id, draft);
  const manifest: CharacterManifest = {
    id,
    name: id,
    version: "2.0.0",
    author: draft.shimeji.format === "android"
      ? "Imported (Android Shimeji)"
      : "Imported (Shimeji)",
    defaultScale: draft.scale,
    defaultSpeed: draft.speed,
    frameWidth: graph.spriteCanvas.width,
    frameHeight: graph.spriteCanvas.height,
    animations: {},
    animationSystem: "shimejiGraph",
    shimejiGraph: graph,
    behaviorSettings: normalizeBehaviorSettings({
      ...DEFAULT_BEHAVIOR_SETTINGS,
      dialogueFrequency: 0.2,
    }),
    dialogueSettings: {
      lines: [],
      frequency: 0.2,
    },
    playbackStyle: "sequential",
    storageVersion: 2,
  };

  await writeJson(await characterManifestPath(id), manifest);
  await addCharacter({ manifest, source: "shimeji", folderPath: destDir });
  return id;
}
