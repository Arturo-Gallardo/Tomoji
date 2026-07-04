import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, basename, dirname, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  rename,
  remove,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

// single seam over the desktop filesystem. everything that touches disk goes
// through here so the backing api (tauri today) can be swapped without
// rippling through the importer/library code.

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export async function pickDirectory(title: string): Promise<string | null> {
  // recursive so the granted fs/asset scope covers nested sprite subfolders
  const selection = await open({
    directory: true,
    multiple: false,
    recursive: true,
    title,
  });
  return typeof selection === "string" ? selection : null;
}

export async function pickFile(
  title: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<string | null> {
  const selection = await open({
    directory: false,
    multiple: false,
    title,
    filters,
  });
  return typeof selection === "string" ? selection : null;
}

// converts an absolute disk path into a url the webview <img> can load.
export function toAssetUrl(absolutePath: string): string {
  return convertFileSrc(absolutePath);
}

export async function getAppDataDir(): Promise<string> {
  return appDataDir();
}

export async function joinPath(...segments: string[]): Promise<string> {
  return join(...segments);
}

export async function getBasename(path: string): Promise<string> {
  return basename(path);
}

export async function getDirname(path: string): Promise<string> {
  return dirname(path);
}

export async function pathExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function ensureDir(path: string): Promise<void> {
  if (await exists(path)) {
    return;
  }
  await mkdir(path, { recursive: true });
}

export async function removePath(path: string): Promise<void> {
  if (await exists(path)) {
    await remove(path, { recursive: true });
  }
}

export async function renamePath(source: string, dest: string): Promise<void> {
  await rename(source, dest);
}

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readTextFile(path);
  return JSON.parse(raw) as T;
}

export async function readText(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir(await dirname(path));
  const tempPath = `${path}.${crypto.randomUUID()}.tmp`;

  try {
    await writeTextFile(tempPath, JSON.stringify(data, null, 2));
    await rename(tempPath, path);
  } catch (error) {
    if (await exists(tempPath)) {
      await remove(tempPath);
    }
    throw error;
  }
}

export async function readBinary(path: string): Promise<Uint8Array> {
  return readFile(path);
}

export async function writeBinary(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  await writeFile(path, bytes);
}

// copies a file by streaming bytes; works across the import boundary
// (user-picked folder -> appData character folder).
export async function copyFile(
  sourcePath: string,
  destPath: string,
): Promise<void> {
  const bytes = await readFile(sourcePath);
  await writeFile(destPath, bytes);
}

async function copyDirectory(source: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await listDirectory(source);

  for (const entry of entries) {
    const destEntry = await joinPath(dest, entry.name);
    if (entry.isDirectory) {
      await copyDirectory(entry.path, destEntry);
      continue;
    }

    await copyFile(entry.path, destEntry);
  }
}

export async function movePath(source: string, dest: string): Promise<void> {
  if (!(await pathExists(source))) {
    return;
  }

  if (await pathExists(dest)) {
    throw new Error(`destination already exists: ${dest}`);
  }

  await copyDirectory(source, dest);
  await removePath(source);
}

export async function listDirectory(path: string): Promise<DirectoryEntry[]> {
  const entries = await readDir(path);
  const resolved: DirectoryEntry[] = [];

  for (const entry of entries) {
    resolved.push({
      name: entry.name,
      path: await join(path, entry.name),
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
    });
  }

  return resolved;
}
