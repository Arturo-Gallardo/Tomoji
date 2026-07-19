import type { AnimationCategory, CharacterManifest } from "../types/character";
import { addCharacter, allocateNewTomojiFolderName } from "./characterLibrary";
import { characterDirPath, characterManifestPath } from "./fs/appPaths";
import {
  copyFile,
  ensureDir,
  getDirname,
  joinPath,
  pathExists,
  pickDirectory,
  readJson,
  writeJson,
} from "./fs/fileSystemAdapter";
import {
  validateManifestAssets,
  validateManifestShape,
  type ValidationResult,
} from "./manifestValidator";

export interface TomojiImportResult {
  ok: boolean;
  characterId?: string;
  errors: string[];
  warnings: string[];
}

export interface TomojiImportScan {
  sourceDir: string;
  manifest: CharacterManifest;
  animationFramePaths: Partial<Record<AnimationCategory, string[]>>;
  warnings: string[];
}

function mergeResults(...results: ValidationResult[]): ValidationResult {
  return {
    valid: results.every((result) => result.valid),
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}

// copies every referenced sprite into the character's appData folder,
// preserving the relative paths the manifest points at.
async function copyManifestAssets(
  manifest: CharacterManifest,
  sourceDir: string,
  destDir: string,
): Promise<void> {
  const seen = new Set<string>();

  for (const definition of Object.values(manifest.animations)) {
    if (!definition) {
      continue;
    }
    for (const frame of definition.frames) {
      if (seen.has(frame.src)) {
        continue;
      }
      seen.add(frame.src);

      const source = await joinPath(sourceDir, frame.src);
      const dest = await joinPath(destDir, frame.src);
      await ensureDir(await getDirname(dest));
      await copyFile(source, dest);
    }
  }
}

export async function pickTomojiImportFolder(): Promise<string | null> {
  return pickDirectory("Select a Tomoji character folder");
}

export async function scanTomojiImportFolder(
  sourceDir: string,
): Promise<TomojiImportScan | TomojiImportResult> {
  const manifestPath = await joinPath(sourceDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    return { ok: false, errors: ["manifest.json not found in folder"], warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = await readJson<unknown>(manifestPath);
  } catch {
    return { ok: false, errors: ["manifest.json is not valid JSON"], warnings: [] };
  }

  const shape = validateManifestShape(parsed);
  if (!shape.valid) {
    return { ok: false, errors: shape.errors, warnings: shape.warnings };
  }

  const manifest = parsed as CharacterManifest;
  const assets = await validateManifestAssets(manifest, sourceDir);
  const combined = mergeResults(shape, assets);
  if (!combined.valid) {
    return { ok: false, errors: combined.errors, warnings: combined.warnings };
  }

  const animationFramePaths = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.animations).flatMap(([category, definition]) =>
        definition
          ? [
              Promise.all(
                definition.frames.map((frame) => joinPath(sourceDir, frame.src)),
              ).then((paths) => [category, paths] as const),
            ]
          : [],
      ),
    ),
  ) as Partial<Record<AnimationCategory, string[]>>;

  return {
    sourceDir,
    manifest,
    animationFramePaths,
    warnings: combined.warnings,
  };
}

export async function importScannedTomoji(
  scan: TomojiImportScan,
  name: string,
): Promise<TomojiImportResult> {
  const id = await allocateNewTomojiFolderName(name.trim() || scan.manifest.name);
  const storedManifest: CharacterManifest = { ...scan.manifest, id, name: id };
  const destDir = await characterDirPath(id);
  await ensureDir(destDir);
  await copyManifestAssets(storedManifest, scan.sourceDir, destDir);
  await writeJson(await characterManifestPath(id), storedManifest);

  await addCharacter({
    manifest: storedManifest,
    source: "tomoji",
    folderPath: destDir,
  });

  return {
    ok: true,
    characterId: id,
    errors: [],
    warnings: scan.warnings,
  };
}
