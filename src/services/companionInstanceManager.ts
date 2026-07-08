import { emit } from "@tauri-apps/api/event";
import type { CompanionInstance } from "../types/companionInstance";
import type { CharacterManifest } from "../types/character";
import { getDesktopBounds } from "./companionApi";
import {
  createCompanionInstanceWindow,
  destroyCompanionInstanceWindow,
} from "./companionApi";
import type { CharacterLibraryEntry } from "../types/character";
import { normalizeToTomojiFolderId } from "./characterFolderName";
import {
  BUILTIN_CHARACTER_ID,
  getCharacter,
  isBuiltinCharacterId,
  listCharacters,
  removeCharacter,
  renameTomojiCharacter,
  syncCharactersFromDisk,
} from "./characterLibrary";
import { ensureBuiltinCharacterStored } from "./builtinCharacter";
import { getAppSettings } from "./appSettings";
import { normalizeBehaviorSettings } from "./behaviorSettings";
import { instancesFilePath } from "./fs/appPaths";
import { pathExists, readJson, writeJson } from "./fs/fileSystemAdapter";

// broadcast whenever the instance registry changes so every window can reload.
export const COMPANION_REGISTRY_EVENT = "companion-registry-changed";

const INSTANCES_VERSION = 1;
// horizontal gap between freshly spawned companions so they don't fully overlap
const SPAWN_STAGGER_PX = 160;

interface InstancesFile {
  version: number;
  instances: CompanionInstance[];
}

async function readStoredInstances(): Promise<CompanionInstance[]> {
  const path = await instancesFilePath();
  if (!(await pathExists(path))) {
    return [];
  }

  try {
    const file = await readJson<InstancesFile>(path);
    return file.instances ?? [];
  } catch (error) {
    console.error("failed to read companion instances", error);
    return [];
  }
}

async function writeStoredInstances(
  instances: CompanionInstance[],
): Promise<void> {
  const file: InstancesFile = { version: INSTANCES_VERSION, instances };
  await writeJson(await instancesFilePath(), file);
  await emit(COMPANION_REGISTRY_EVENT);
}

async function ensureBuiltinInstancePresent(): Promise<CompanionInstance[]> {
  await ensureBuiltinCharacterStored();
  let instances = await readStoredInstances();
  const hasBuiltin = instances.some((instance) =>
    isBuiltinCharacterId(instance.characterId),
  );

  if (hasBuiltin) {
    return instances;
  }

  const builtin = await getCharacter(BUILTIN_CHARACTER_ID);
  if (!builtin) {
    throw new Error("built-in character is missing from local storage");
  }

  const position = await defaultSpawnAnchor(instances.length);
  const seed = instanceFromCharacter(
    "default",
    builtin.manifest.name,
    builtin.manifest,
    position,
    true,
  );
  instances = [...instances, seed];
  await writeStoredInstances(instances);
  return instances;
}

function resolveLibraryEntry(
  instance: CompanionInstance,
  characterById: Map<string, CharacterLibraryEntry>,
): CharacterLibraryEntry | null {
  const direct = characterById.get(instance.characterId);
  if (direct !== undefined) {
    return direct;
  }

  const byStoredName = characterById.get(instance.name);
  if (byStoredName !== undefined) {
    return byStoredName;
  }

  for (const candidate of [instance.characterId, instance.name]) {
    const normalized = normalizeToTomojiFolderId(candidate);
    const match = characterById.get(normalized);
    if (match !== undefined) {
      return match;
    }
  }

  return null;
}

// disk folders are source of truth: drop orphan cards, fix stale ids, keep
// explicit duplicate instances.
async function repairCompanionRegistry(
  instances: CompanionInstance[],
): Promise<{
  instances: CompanionInstance[];
  newlyAdded: CompanionInstance[];
}> {
  const characters = await listCharacters();
  const imported = characters.filter(
    (entry) => !isBuiltinCharacterId(entry.manifest.id),
  );
  const characterById = new Map(
    imported.map((entry) => [entry.manifest.id, entry]),
  );

  let changed = false;
  const next: CompanionInstance[] = [];
  const seenCharacterIds = new Set<string>();
  const newlyAdded: CompanionInstance[] = [];

  for (const instance of instances) {
    if (instance.isTemporaryClone) {
      changed = true;
      if (instance.enabled) {
        await destroyCompanionInstanceWindow(instance.id);
      }
      continue;
    }

    if (isBuiltinCharacterId(instance.characterId)) {
      seenCharacterIds.add(BUILTIN_CHARACTER_ID);
      next.push(instance);
      continue;
    }

    const entry = resolveLibraryEntry(instance, characterById);
    if (entry === null) {
      changed = true;
      if (instance.enabled) {
        await destroyCompanionInstanceWindow(instance.id);
      }
      continue;
    }

    const folderName = entry.manifest.id;
    seenCharacterIds.add(folderName);
    const repaired: CompanionInstance = {
      ...instance,
      characterId: folderName,
      name: folderName,
    };

    if (
      repaired.characterId !== instance.characterId ||
      repaired.name !== instance.name
    ) {
      changed = true;
    }

    next.push(repaired);
  }

  for (const character of imported) {
    if (seenCharacterIds.has(character.manifest.id)) {
      continue;
    }

    const instance = instanceFromCharacter(
      crypto.randomUUID(),
      character.manifest.id,
      character.manifest,
      await defaultSpawnAnchor(next.length),
      false,
    );
    next.push(instance);
    newlyAdded.push(instance);
    seenCharacterIds.add(character.manifest.id);
    changed = true;
  }

  if (changed) {
    await writeStoredInstances(next);
  }

  return {
    instances: changed ? next : instances,
    newlyAdded,
  };
}

let reconcileInFlight: Promise<{
  instances: CompanionInstance[];
  newlyAdded: CompanionInstance[];
}> | null = null;

async function reconcileTomojiRegistryInternal(): Promise<{
  instances: CompanionInstance[];
  newlyAdded: CompanionInstance[];
}> {
  await syncCharactersFromDisk();
  const instances = await ensureBuiltinInstancePresent();
  return repairCompanionRegistry(instances);
}

// full disk sync + instance repair. deduped — safe to call from poll/refresh.
export async function reconcileTomojiRegistry(options?: {
  spawnNew?: boolean;
  refreshEnabled?: boolean;
}): Promise<CompanionInstance[]> {
  const spawnNew = options?.spawnNew ?? false;
  const refreshEnabled = options?.refreshEnabled ?? false;

  if (!reconcileInFlight) {
    reconcileInFlight = reconcileTomojiRegistryInternal().finally(() => {
      reconcileInFlight = null;
    });
  }

  const result = await reconcileInFlight;
  if (refreshEnabled) {
    for (const instance of result.instances) {
      if (!instance.enabled || instance.archived) {
        continue;
      }

      try {
        await destroyCompanionInstanceWindow(instance.id);
        await spawnInstanceWindow(instance);
      } catch (error) {
        console.error("failed to refresh companion", error);
      }
    }
  } else if (spawnNew) {
    for (const instance of result.newlyAdded) {
      if (!instance.enabled || instance.archived) {
        continue;
      }

      try {
        await spawnInstanceWindow(instance);
      } catch (error) {
        console.error("failed to spawn companion for imported folder", error);
      }
    }
  }

  return result.instances;
}

export async function readCompanionInstances(): Promise<CompanionInstance[]> {
  await ensureBuiltinInstancePresent();
  return readStoredInstances();
}

export async function listInstances(): Promise<CompanionInstance[]> {
  return readCompanionInstances();
}

export async function getInstance(
  id: string,
): Promise<CompanionInstance | null> {
  const instances = await readStoredInstances();
  return instances.find((instance) => instance.id === id) ?? null;
}

function instanceFromCharacter(
  id: string,
  name: string,
  manifest: CharacterManifest,
  position: { x: number; y: number },
  enabled: boolean,
): CompanionInstance {
  return {
    id,
    name,
    characterId: manifest.id,
    position,
    velocity: { x: 0, y: 0 },
    scale: manifest.defaultScale,
    enabled,
    muted: false,
    currentAnimation: "idle",
    behaviorState: "idle",
    behaviorSettings: normalizeBehaviorSettings(manifest.behaviorSettings),
    dialogueSettings: { ...manifest.dialogueSettings },
  };
}

// bottom-right floor of the rightmost monitor, staggered by how many
// companions already exist so new ones land beside the old ones.
async function defaultSpawnAnchor(index: number): Promise<{ x: number; y: number }> {
  try {
    const bounds = await getDesktopBounds();
    const rightmost = bounds.monitors.reduce((furthest, monitor) =>
      monitor.x + monitor.width > furthest.x + furthest.width ? monitor : furthest,
    );
    return {
      x: rightmost.x + rightmost.width - 64 - index * SPAWN_STAGGER_PX,
      y: rightmost.y + rightmost.height,
    };
  } catch {
    return { x: 200 + index * SPAWN_STAGGER_PX, y: 600 };
  }
}

async function spawnInstanceWindow(instance: CompanionInstance): Promise<void> {
  const character = await getCharacter(instance.characterId);
  if (!character) {
    throw new Error(`character not found: ${instance.characterId}`);
  }
  const { manifest } = character;
  const width = manifest.frameWidth * instance.scale;
  const height = manifest.frameHeight * instance.scale;
  const windowX = instance.position.x - width / 2;
  const windowY = instance.position.y - height;
  await createCompanionInstanceWindow(instance.id, windowX, windowY, width, height);
}

export async function addInstance(
  characterId: string,
  name?: string,
): Promise<CompanionInstance> {
  const instances = await readStoredInstances();
  const character = await getCharacter(characterId);
  if (!character) {
    throw new Error(`character not found: ${characterId}`);
  }
  const position = await defaultSpawnAnchor(instances.length);
  const instance = instanceFromCharacter(
    crypto.randomUUID(),
    name ?? character.manifest.id,
    character.manifest,
    position,
    false,
  );

  await writeStoredInstances([...instances, instance]);
  return instance;
}

function cloneInstanceName(source: CompanionInstance): string {
  return isBuiltinCharacterId(source.characterId)
    ? source.name
    : source.characterId;
}

function cloneSpawnAnchor(source: CompanionInstance): { x: number; y: number } {
  return {
    x: source.position.x + SPAWN_STAGGER_PX,
    y: source.position.y,
  };
}

export async function duplicateTemporaryInstance(
  id: string,
): Promise<CompanionInstance> {
  const instances = await readStoredInstances();
  const source = instances.find((instance) => instance.id === id);
  if (!source) {
    throw new Error(`companion instance not found: ${id}`);
  }

  if (!(await getCharacter(source.characterId))) {
    throw new Error(`character not found: ${source.characterId}`);
  }

  const duplicate: CompanionInstance = {
    ...source,
    id: crypto.randomUUID(),
    name: cloneInstanceName(source),
    position: cloneSpawnAnchor(source),
    velocity: { x: 0, y: 0 },
    enabled: true,
    archived: false,
    isTemporaryClone: true,
    parentInstanceId: source.parentInstanceId ?? source.id,
    currentAnimation: "idle",
    behaviorState: "idle",
    behaviorSettings: { ...source.behaviorSettings },
    dialogueSettings: { ...source.dialogueSettings },
  };

  await writeStoredInstances([...instances, duplicate]);

  if (duplicate.enabled) {
    await spawnInstanceWindow(duplicate);
  }

  return duplicate;
}

function isLastBuiltinInstance(
  target: CompanionInstance | undefined,
  instances: readonly CompanionInstance[],
): boolean {
  if (!target || !isBuiltinCharacterId(target.characterId)) {
    return false;
  }

  const builtinCount = instances.filter(
    (instance) =>
      !instance.isTemporaryClone && isBuiltinCharacterId(instance.characterId),
  ).length;
  return builtinCount <= 1;
}

function linkedTemporaryCloneIds(
  parentId: string,
  instances: readonly CompanionInstance[],
): Set<string> {
  return new Set(
    instances
      .filter(
        (instance) =>
          instance.isTemporaryClone && instance.parentInstanceId === parentId,
      )
      .map((instance) => instance.id),
  );
}

export async function removeInstance(id: string): Promise<void> {
  const instances = await readStoredInstances();
  const target = instances.find((instance) => instance.id === id);
  if (isLastBuiltinInstance(target, instances)) {
    return;
  }

  const characterId = target?.characterId;
  const linkedCloneIds =
    target && !target.isTemporaryClone
      ? linkedTemporaryCloneIds(target.id, instances)
      : new Set<string>();
  const removedIds = new Set([id, ...linkedCloneIds]);
  const remaining = instances.filter((instance) => !removedIds.has(instance.id));
  await writeStoredInstances(remaining);
  for (const removedId of removedIds) {
    await destroyCompanionInstanceWindow(removedId);
  }

  if (
    characterId !== undefined &&
    !isBuiltinCharacterId(characterId) &&
    !target?.isTemporaryClone &&
    !remaining.some(
      (instance) =>
        !instance.isTemporaryClone && instance.characterId === characterId,
    )
  ) {
    await removeCharacter(characterId);
  }
}

export async function setInstanceEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  const instances = await readStoredInstances();
  const target = instances.find((instance) => instance.id === id);
  if (!target || (enabled && target.archived)) {
    return;
  }

  if (target.isTemporaryClone) {
    if (enabled) {
      await spawnInstanceWindow({ ...target, enabled: true });
      return;
    }

    await writeStoredInstances(instances.filter((instance) => instance.id !== id));
    await destroyCompanionInstanceWindow(id);
    return;
  }

  const linkedCloneIds = enabled
    ? new Set<string>()
    : linkedTemporaryCloneIds(id, instances);
  const next = instances.map((instance) =>
    instance.id === id ? { ...instance, enabled } : instance,
  ).filter((instance) => !linkedCloneIds.has(instance.id));
  await writeStoredInstances(next);

  if (enabled) {
    await spawnInstanceWindow({ ...target, enabled: true });
  } else {
    await destroyCompanionInstanceWindow(id);
    for (const cloneId of linkedCloneIds) {
      await destroyCompanionInstanceWindow(cloneId);
    }
  }
}

export async function setActiveInstancesEnabled(enabled: boolean): Promise<void> {
  const instances = await readStoredInstances();
  const cloneIds = new Set(
    instances
      .filter((instance) => instance.isTemporaryClone)
      .map((instance) => instance.id),
  );
  const changedInstances = instances.filter(
    (instance) =>
      !instance.isTemporaryClone &&
      !instance.archived &&
      instance.enabled !== enabled,
  );

  if (changedInstances.length === 0 && cloneIds.size === 0) {
    return;
  }

  const next = instances
    .filter((instance) => !instance.isTemporaryClone)
    .map((instance) =>
      instance.archived ? instance : { ...instance, enabled },
    );
  await writeStoredInstances(next);

  if (enabled) {
    for (const instance of changedInstances) {
      await spawnInstanceWindow({ ...instance, enabled });
    }
    return;
  }

  for (const instance of changedInstances) {
    await destroyCompanionInstanceWindow(instance.id);
  }
  for (const cloneId of cloneIds) {
    await destroyCompanionInstanceWindow(cloneId);
  }
}

export async function updateInstance(
  id: string,
  patch: Partial<Omit<CompanionInstance, "id">>,
): Promise<void> {
  const instances = await readStoredInstances();
  const target = instances.find((instance) => instance.id === id);
  if (!target) {
    return;
  }

  const { name: namePatch, ...restPatch } = patch;
  const oldCharacterId = target.characterId;
  let characterId = oldCharacterId;
  let resolvedName = target.name;

  if (namePatch !== undefined) {
    if (isBuiltinCharacterId(oldCharacterId)) {
      resolvedName = namePatch.trim() || target.name;
    } else {
      const trimmed = namePatch.trim();
      if (trimmed !== "" && trimmed !== oldCharacterId) {
        characterId = await renameTomojiCharacter(oldCharacterId, trimmed);
      }
      resolvedName = characterId;
    }
  }

  const next = instances.map((instance) => {
    if (instance.characterId === oldCharacterId) {
      return {
        ...instance,
        characterId,
        name: resolvedName,
        ...(instance.id === id ? restPatch : {}),
      };
    }

    if (instance.id === id) {
      return {
        ...instance,
        ...restPatch,
        characterId,
        name: resolvedName,
      };
    }

    return instance;
  });

  await writeStoredInstances(next);
}

export async function archiveInstance(id: string): Promise<void> {
  const instances = await readStoredInstances();
  const target = instances.find((instance) => instance.id === id);
  if (!target) {
    return;
  }

  if (target.isTemporaryClone) {
    await removeInstance(id);
    return;
  }

  const linkedCloneIds = linkedTemporaryCloneIds(id, instances);
  const next = instances
    .filter((instance) => !linkedCloneIds.has(instance.id))
    .map((instance) =>
      instance.id === id
        ? { ...instance, archived: true, enabled: false }
        : instance,
    );
  await writeStoredInstances(next);
  if (target.enabled) {
    await destroyCompanionInstanceWindow(id);
  }
  for (const cloneId of linkedCloneIds) {
    await destroyCompanionInstanceWindow(cloneId);
  }
}

export async function unarchiveInstance(id: string): Promise<void> {
  const instances = await readStoredInstances();
  const next = instances.map((instance) =>
    instance.id === id ? { ...instance, archived: false } : instance,
  );
  await writeStoredInstances(next);
}

// keeps archived companions at the tail; only reorders the active list
export async function reorderActiveInstances(
  orderedActiveIds: string[],
): Promise<void> {
  const instances = await readStoredInstances();
  const active = instances.filter(
    (instance) => !instance.archived && !instance.isTemporaryClone,
  );
  const temporary = instances.filter((instance) => instance.isTemporaryClone);
  const archived = instances.filter((instance) => instance.archived);
  const byId = new Map(active.map((instance) => [instance.id, instance]));

  const reorderedActive = orderedActiveIds
    .map((id) => byId.get(id))
    .filter((instance): instance is CompanionInstance => instance !== undefined);

  const missingActive = active.filter(
    (instance) => !orderedActiveIds.includes(instance.id),
  );

  await writeStoredInstances([
    ...reorderedActive,
    ...missingActive,
    ...temporary,
    ...archived,
  ]);
}

let bootstrapInFlight: Promise<CompanionInstance[]> | null = null;

async function bootstrapCompanionsInternal(): Promise<CompanionInstance[]> {
  const instances = await reconcileTomojiRegistry({ spawnNew: false });

  const { restoreCompanionsOnLaunch } = await getAppSettings();
  if (restoreCompanionsOnLaunch) {
    for (const instance of instances) {
      if (instance.enabled && !instance.archived && !instance.isTemporaryClone) {
        await spawnInstanceWindow(instance);
      }
    }
  }

  return instances;
}

// ensures a first companion exists, then opens windows for enabled instances.
// called once when the dashboard mounts. deduped because react strict mode
// can fire the dashboard effect twice before the first spawn finishes.
export async function bootstrapCompanions(): Promise<CompanionInstance[]> {
  if (!bootstrapInFlight) {
    bootstrapInFlight = bootstrapCompanionsInternal().finally(() => {
      bootstrapInFlight = null;
    });
  }

  return bootstrapInFlight;
}

export { BUILTIN_CHARACTER_ID };
