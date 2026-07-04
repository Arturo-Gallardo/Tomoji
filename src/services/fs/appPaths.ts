import { getAppDataDir, joinPath } from "./fileSystemAdapter";

// centralizes the on-disk layout so the importer, library and manager all
// agree on where things live:
//   <appData>/library.json
//   <appData>/instances.json
//   <appData>/settings.json
//   <appData>/characters/beyond-birthday/manifest.json  (bundled pet, seeded on first run)
//   <appData>/characters/<folder-name>/manifest.json
//   <appData>/characters/<folder-name>/sprites/<category>/*.{png,jpg,webp,bmp}
//   <appData>/characters/<folder-name>/source/*.{png,jpg,webp,bmp}

export async function libraryFilePath(): Promise<string> {
  return joinPath(await getAppDataDir(), "library.json");
}

export async function instancesFilePath(): Promise<string> {
  return joinPath(await getAppDataDir(), "instances.json");
}

export async function settingsFilePath(): Promise<string> {
  return joinPath(await getAppDataDir(), "settings.json");
}

export async function charactersDirPath(): Promise<string> {
  return joinPath(await getAppDataDir(), "characters");
}

export async function characterDirPath(characterId: string): Promise<string> {
  return joinPath(await charactersDirPath(), characterId);
}

export async function characterManifestPath(
  characterId: string,
): Promise<string> {
  return joinPath(await characterDirPath(characterId), "manifest.json");
}

export async function characterSpritesDirPath(
  characterId: string,
): Promise<string> {
  return joinPath(await characterDirPath(characterId), "sprites");
}

export async function characterSourcesDirPath(
  characterId: string,
): Promise<string> {
  return joinPath(await characterDirPath(characterId), "source");
}
