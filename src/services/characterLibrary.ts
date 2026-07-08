import { emit } from "@tauri-apps/api/event";
import type {
  AnimationCategory,
  CharacterLibraryEntry,
  CharacterManifest,
  CharacterSource,
  SurfaceAttachmentOffsets,
} from "../types/character";
import {
  BUILTIN_CHARACTER_ID,
  ensureBuiltinCharacterStored,
} from "./builtinCharacter";
import {
  allocateTomojiFolderName,
  isTomojiFolderId,
  resolveTomojiFolderName,
} from "./characterFolderName";
import {
  characterDirPath,
  characterManifestPath,
  characterSourcesDirPath,
  charactersDirPath,
  instancesFilePath,
  libraryFilePath,
} from "./fs/appPaths";
import {
  copyFile,
  ensureDir,
  getBasename,
  getDirname,
  joinPath,
  listDirectory,
  movePath,
  pathExists,
  readJson,
  removePath,
  writeJson,
} from "./fs/fileSystemAdapter";
import {
  validateManifestAssets,
  validateManifestShape,
} from "./manifestValidator";

const COMPANION_REGISTRY_EVENT = "companion-registry-changed";

export { BUILTIN_CHARACTER_ID };

export function isBuiltinCharacterId(id: string): boolean {
  return id === BUILTIN_CHARACTER_ID;
}

// broadcast when imported character manifests or sprites change on disk.
export const CHARACTER_LIBRARY_EVENT = "character-library-changed";

const LIBRARY_VERSION = 1;

interface InstancesFile {
  version: number;
  instances: { characterId: string; name?: string }[];
}

let folderMigrationDone = false;
let folderMigrationPromise: Promise<void> | null = null;

async function migrateInstanceCharacterIds(
  idMap: Map<string, string>,
): Promise<void> {
  if (idMap.size === 0) {
    return;
  }

  const path = await instancesFilePath();
  if (!(await pathExists(path))) {
    return;
  }

  try {
    const file = await readJson<InstancesFile>(path);
    let changed = false;
    const instances = (file.instances ?? []).map((instance) => {
      const nextId = idMap.get(instance.characterId);
      if (nextId === undefined) {
        return instance;
      }

      changed = true;
      return { ...instance, characterId: nextId };
    });

    if (changed) {
      await writeJson(path, { ...file, instances });
      await emit(COMPANION_REGISTRY_EVENT);
    }
  } catch (error) {
    console.error("failed to migrate companion instance character ids", error);
  }
}

async function migrateTomojiFolderNames(): Promise<void> {
  const stored = await readStoredCharacters();
  if (stored.length === 0) {
    return;
  }

  const taken = new Set<string>([BUILTIN_CHARACTER_ID]);
  for (const entry of stored) {
    if (isBuiltinCharacterId(entry.manifest.id)) {
      continue;
    }

    if (isTomojiFolderId(entry.manifest.id)) {
      taken.add(entry.manifest.id);
    }
  }

  let changed = false;
  const idMap = new Map<string, string>();
  const next: CharacterLibraryEntry[] = [];

  for (const entry of stored) {
    if (isBuiltinCharacterId(entry.manifest.id)) {
      next.push(entry);
      continue;
    }

    const currentId = entry.manifest.id;
    let targetId = currentId;

    if (!isTomojiFolderId(currentId)) {
      targetId = allocateTomojiFolderName(entry.manifest.name, taken);
    }

    taken.add(targetId);

    if (currentId === targetId) {
      let manifest = entry.manifest;
      if (manifest.name !== targetId) {
        manifest = { ...manifest, name: targetId };
        await writeJson(await characterManifestPath(targetId), manifest);
        changed = true;
      }

      next.push({
        ...entry,
        manifest,
        folderPath: entry.folderPath ?? (await characterDirPath(targetId)),
      });
      continue;
    }

    const oldDir =
      entry.folderPath ?? (await characterDirPath(currentId));
    const newDir = await characterDirPath(targetId);
    if (await pathExists(oldDir) && !(await pathExists(newDir))) {
      await movePath(oldDir, newDir);
    }

    const manifest = { ...entry.manifest, id: targetId, name: targetId };
    await writeJson(await characterManifestPath(targetId), manifest);

    next.push({
      manifest,
      source: entry.source,
      folderPath: newDir,
    });
    idMap.set(currentId, targetId);
    changed = true;
  }

  if (changed) {
    await writeStoredCharacters(next);
    await migrateInstanceCharacterIds(idMap);
  }

  await syncInstanceDisplayNames(next);
}

async function syncInstanceDisplayNames(
  characters: CharacterLibraryEntry[],
): Promise<void> {
  const displayNameByCharacterId = new Map(
    characters
      .filter((entry) => !isBuiltinCharacterId(entry.manifest.id))
      .map((entry) => [entry.manifest.id, entry.manifest.name]),
  );

  if (displayNameByCharacterId.size === 0) {
    return;
  }

  const path = await instancesFilePath();
  if (!(await pathExists(path))) {
    return;
  }

  try {
    const file = await readJson<InstancesFile>(path);
    let instancesChanged = false;
    const instances = (file.instances ?? []).map((instance) => {
      const expectedName = displayNameByCharacterId.get(instance.characterId);
      if (expectedName === undefined || instance.name === expectedName) {
        return instance;
      }

      instancesChanged = true;
      return { ...instance, name: expectedName };
    });

    if (instancesChanged) {
      await writeJson(path, { ...file, instances });
      await emit(COMPANION_REGISTRY_EVENT);
    }
  } catch (error) {
    console.error("failed to sync companion instance display names", error);
  }
}

async function ensureTomojiFolderNamesMigrated(): Promise<void> {
  if (folderMigrationDone) {
    return;
  }

  if (!folderMigrationPromise) {
    folderMigrationPromise = migrateTomojiFolderNames()
      .then(() => {
        folderMigrationDone = true;
      })
      .catch((error) => {
        console.error("failed to migrate tomoji folder names", error);
      })
      .finally(() => {
        folderMigrationPromise = null;
      });
  }

  await folderMigrationPromise;
}

async function migrateCharacterSources(
  manifest: CharacterManifest,
  characterDir: string,
): Promise<CharacterManifest> {
  const characterId = manifest.id;
  const legacySourcesDir = await joinPath(characterDir, "sprites", "source");
  const sourcesDir = await characterSourcesDirPath(characterId);
  const externalSourcesDir = await joinPath(
    await getDirname(characterDir),
    "..",
    "sources",
    characterId,
  );

  if (
    !(await pathExists(sourcesDir)) &&
    (await pathExists(legacySourcesDir))
  ) {
    await movePath(legacySourcesDir, sourcesDir);
  }
  if (
    !(await pathExists(sourcesDir)) &&
    (await pathExists(externalSourcesDir))
  ) {
    await movePath(externalSourcesDir, sourcesDir);
  }

  await ensureDir(sourcesDir);

  const sourceFilenameBySrc = new Map<string, string>();
  const usedFilenames = new Set(
    (await listDirectory(sourcesDir))
      .filter((entry) => entry.isFile)
      .map((entry) => entry.name),
  );
  let changed = false;

  const animations = { ...manifest.animations };

  for (const [category, definition] of Object.entries(
    manifest.animations,
  ) as [AnimationCategory, NonNullable<typeof manifest.animations[AnimationCategory]>][]) {
    const frames = [];

    for (let index = 0; index < definition.frames.length; index += 1) {
      const frame = definition.frames[index];
      const existingFilename = frame.source
        ? await getBasename(frame.source)
        : sourceFilenameBySrc.get(frame.src);
      let filename = existingFilename;

      if (!filename) {
        const basename = await getBasename(frame.src);
        filename = `${category}-${index
          .toString()
          .padStart(4, "0")}-${basename}`;

        let suffix = 1;
        while (usedFilenames.has(filename)) {
          filename = `${category}-${index
            .toString()
            .padStart(4, "0")}-${suffix}-${basename}`;
          suffix += 1;
        }
      }

      const sourcePath = await joinPath(sourcesDir, filename);
      if (!(await pathExists(sourcePath))) {
        await copyFile(await joinPath(characterDir, frame.src), sourcePath);
      }

      usedFilenames.add(filename);
      sourceFilenameBySrc.set(frame.src, filename);

      if (frame.source === filename) {
        frames.push(frame);
        continue;
      }

      changed = true;
      frames.push({ ...frame, source: filename });
    }

    animations[category] = { ...definition, frames };
  }

  return changed ? { ...manifest, animations } : manifest;
}

export async function allocateNewTomojiFolderName(name: string): Promise<string> {
  await ensureTomojiFolderNamesMigrated();
  const stored = await readStoredCharacters();
  const taken = new Set(stored.map((entry) => entry.manifest.id));
  taken.add(BUILTIN_CHARACTER_ID);
  return allocateTomojiFolderName(name, taken);
}

interface LibraryFile {
  version: number;
  characters: CharacterLibraryEntry[];
}

async function readStoredCharacters(): Promise<CharacterLibraryEntry[]> {
  const path = await libraryFilePath();
  if (!(await pathExists(path))) {
    return [];
  }

  try {
    const file = await readJson<LibraryFile>(path);
    return file.characters ?? [];
  } catch (error) {
    console.error("failed to read character library", error);
    return [];
  }
}

async function writeStoredCharacters(
  characters: CharacterLibraryEntry[],
): Promise<void> {
  const file: LibraryFile = { version: LIBRARY_VERSION, characters };
  await writeJson(await libraryFilePath(), file);
  await emit(CHARACTER_LIBRARY_EVENT);
}

// beyond-birthday lives on disk like every other character; listed first.
export async function listCharacters(): Promise<CharacterLibraryEntry[]> {
  await ensureTomojiFolderNamesMigrated();
  const builtin = await ensureBuiltinCharacterStored();
  const stored = await readStoredCharacters();
  const imported = stored.filter(
    (entry) => entry.manifest.id !== BUILTIN_CHARACTER_ID,
  );
  return [builtin, ...imported];
}

export async function getCharacter(
  id: string,
): Promise<CharacterLibraryEntry | null> {
  if (id === BUILTIN_CHARACTER_ID) {
    return ensureBuiltinCharacterStored();
  }

  await ensureTomojiFolderNamesMigrated();
  const stored = await readStoredCharacters();
  return stored.find((entry) => entry.manifest.id === id) ?? null;
}

export async function addCharacter(
  entry: CharacterLibraryEntry,
): Promise<void> {
  const stored = await readStoredCharacters();
  const next = [
    ...stored.filter((existing) => existing.manifest.id !== entry.manifest.id),
    entry,
  ];
  await writeStoredCharacters(next);
}

export async function updateCharacterSurfaceAttachmentOffsets(
  characterId: string,
  offsets: SurfaceAttachmentOffsets,
): Promise<void> {
  if (isBuiltinCharacterId(characterId)) {
    return;
  }

  const stored = await readStoredCharacters();
  const entry = stored.find((character) => character.manifest.id === characterId);
  if (!entry) {
    return;
  }

  const manifest = {
    ...entry.manifest,
    surfaceAttachmentOffsets: offsets,
  };
  await writeJson(await characterManifestPath(characterId), manifest);
  await writeStoredCharacters(
    stored.map((character) =>
      character.manifest.id === characterId
        ? { ...entry, manifest }
        : character,
    ),
  );
}

export async function removeCharacter(id: string): Promise<void> {
  if (id === BUILTIN_CHARACTER_ID) {
    return;
  }

  await ensureTomojiFolderNamesMigrated();
  const stored = await readStoredCharacters();
  const entry = stored.find((character) => character.manifest.id === id);
  await writeStoredCharacters(
    stored.filter((character) => character.manifest.id !== id),
  );

  const folderPath =
    entry?.folderPath ?? (await characterDirPath(id));
  await removePath(folderPath);
}

export interface CharacterSyncResult {
  added: number;
  updated: number;
  skipped: number;
}

function inferCharacterSource(
  manifest: CharacterManifest,
  existing?: CharacterLibraryEntry,
): CharacterSource {
  if (existing !== undefined) {
    return existing.source;
  }

  if (manifest.author.toLowerCase().includes("shimeji")) {
    return "shimeji";
  }

  return "tomoji";
}

// scans <appData>/characters for manifest folders and registers any that
// are missing from library.json. folder name is the source of truth for id.
export async function syncCharactersFromDisk(): Promise<CharacterSyncResult> {
  await ensureTomojiFolderNamesMigrated();
  await ensureBuiltinCharacterStored();

  const charactersRoot = await charactersDirPath();
  if (!(await pathExists(charactersRoot))) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  const stored = await readStoredCharacters();
  const storedById = new Map(
    stored.map((entry) => [entry.manifest.id, entry]),
  );
  const storedByPath = new Map(
    stored
      .filter((entry) => entry.folderPath !== undefined)
      .map((entry) => [entry.folderPath as string, entry]),
  );
  const entries = await listDirectory(charactersRoot);

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const next: CharacterLibraryEntry[] = [];
  const retainedIds = new Set<string>();

  const preserveExisting = (existing: CharacterLibraryEntry | undefined) => {
    if (existing === undefined || retainedIds.has(existing.manifest.id)) {
      return;
    }

    next.push(existing);
    retainedIds.add(existing.manifest.id);
  };

  for (const entry of entries) {
    if (!entry.isDirectory) {
      continue;
    }

    const folderName = entry.name;
    if (isBuiltinCharacterId(folderName)) {
      continue;
    }
    const existing =
      storedById.get(folderName) ?? storedByPath.get(entry.path);

    const manifestPath = await joinPath(entry.path, "manifest.json");
    if (!(await pathExists(manifestPath))) {
      skipped += 1;
      preserveExisting(existing);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = await readJson<unknown>(manifestPath);
    } catch {
      skipped += 1;
      preserveExisting(existing);
      continue;
    }

    const shape = validateManifestShape(parsed);
    if (!shape.valid) {
      skipped += 1;
      preserveExisting(existing);
      continue;
    }

    let manifest = parsed as CharacterManifest;
    const folderPath = entry.path;
    manifest = await migrateCharacterSources(manifest, folderPath);
    const manifestChanged =
      manifest !== parsed ||
      manifest.id !== folderName ||
      manifest.name !== folderName;

    if (manifestChanged) {
      manifest = { ...manifest, id: folderName, name: folderName };
      await writeJson(manifestPath, manifest);
    }

    const assets = await validateManifestAssets(manifest, folderPath);
    if (!assets.valid) {
      skipped += 1;
      preserveExisting(existing);
      continue;
    }

    const libraryEntry: CharacterLibraryEntry = {
      manifest,
      source: inferCharacterSource(manifest, existing),
      folderPath,
    };
    const manifestContentChanged =
      existing !== undefined &&
      JSON.stringify(existing.manifest) !== JSON.stringify(manifest);

    if (existing === undefined) {
      added += 1;
    } else if (
      manifestChanged ||
      manifestContentChanged ||
      existing.folderPath !== folderPath ||
      existing.manifest.name !== manifest.name
    ) {
      updated += 1;
    }

    next.push(libraryEntry);
    retainedIds.add(manifest.id);
  }

  const storedIds = stored
    .map((entry) => entry.manifest.id)
    .sort()
    .join("\0");
  const nextIds = next
    .map((entry) => entry.manifest.id)
    .sort()
    .join("\0");
  const libraryChanged =
    added > 0 || updated > 0 || storedIds !== nextIds;

  if (libraryChanged) {
    await writeStoredCharacters(next);
  } else {
    await emit(CHARACTER_LIBRARY_EVENT);
  }

  return { added, updated, skipped };
}

export async function renameTomojiCharacter(
  currentId: string,
  nextNameInput: string,
): Promise<string> {
  if (isBuiltinCharacterId(currentId)) {
    throw new Error("built-in character cannot be renamed");
  }

  await ensureTomojiFolderNamesMigrated();
  const stored = await readStoredCharacters();
  const entry = stored.find((character) => character.manifest.id === currentId);
  if (entry === undefined) {
    throw new Error(`character not found: ${currentId}`);
  }

  const taken = new Set(stored.map((character) => character.manifest.id));
  taken.add(BUILTIN_CHARACTER_ID);
  taken.delete(currentId);

  const targetId = resolveTomojiFolderName(nextNameInput, taken);
  if (targetId === currentId) {
    return currentId;
  }

  const oldDir = entry.folderPath ?? (await characterDirPath(currentId));
  const newDir = await characterDirPath(targetId);
  if (await pathExists(oldDir)) {
    await movePath(oldDir, newDir);
  } else {
    await ensureDir(newDir);
  }

  const manifest = { ...entry.manifest, id: targetId, name: targetId };
  await writeJson(await characterManifestPath(targetId), manifest);

  const next = stored.map((character) =>
    character.manifest.id === currentId
      ? { ...entry, manifest, folderPath: newDir }
      : character,
  );
  await writeStoredCharacters(next);
  await migrateInstanceCharacterIds(new Map([[currentId, targetId]]));
  await syncInstanceDisplayNames(next);

  return targetId;
}
