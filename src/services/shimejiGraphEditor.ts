import type { CharacterManifest } from "../types/character";
import type { ShimejiActionIntent, ShimejiMenuAction } from "../types/shimejiGraph";
import { characterDirPath, characterManifestPath } from "./fs/appPaths";
import { joinPath, toAssetUrl, writeJson } from "./fs/fileSystemAdapter";
import { addCharacter, getCharacter } from "./characterLibrary";

export interface ShimejiGraphEditorData {
  manifest: CharacterManifest;
  actionNames: string[];
  editableMenuActions: ShimejiMenuAction[];
  poseUrlsBySrc: Record<string, string>;
}

const ACTION_INTENT_ORDER: readonly ShimejiActionIntent[] = [
  "idle",
  "walk",
  "floorCrawl",
  "sit",
  "sitAlt",
  "sitAlt2",
  "sitOnBar",
  "dangleOnBar",
  "fall",
  "bounce",
  "dragged",
  "dragResist",
  "grabWall",
  "climbWall",
  "grabCeiling",
  "climbCeiling",
];

export { ACTION_INTENT_ORDER };

export async function loadShimejiGraphEditorData(
  characterId: string,
): Promise<ShimejiGraphEditorData> {
  const entry = await getCharacter(characterId);
  if (!entry?.manifest.shimejiGraph) {
    throw new Error("This Tomoji is not a Shimeji graph import.");
  }

  const graph = entry.manifest.shimejiGraph;
  const actionNames = Object.values(graph.actions)
    .filter((action) => action.poses.length > 0 || action.references.length > 0)
    .map((action) => action.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const characterDir = await characterDirPath(characterId);
  const poseUrlsBySrc: Record<string, string> = {};

  for (const action of Object.values(graph.actions)) {
    for (const pose of action.poses) {
      if (pose.src && poseUrlsBySrc[pose.src] === undefined) {
        poseUrlsBySrc[pose.src] = toAssetUrl(await joinPath(characterDir, pose.src));
      }
    }
  }

  return {
    manifest: entry.manifest,
    actionNames,
    editableMenuActions: graph.menuActions,
    poseUrlsBySrc,
  };
}

export async function saveShimejiGraphEditorData(
  characterId: string,
  defaultActions: Partial<Record<ShimejiActionIntent, string>>,
  menuActionNames: readonly string[],
): Promise<void> {
  const entry = await getCharacter(characterId);
  if (!entry?.manifest.shimejiGraph) {
    throw new Error("This Tomoji is not a Shimeji graph import.");
  }

  const graph = entry.manifest.shimejiGraph;
  const menuActions = menuActionNames
    .filter((name, index, names) => name.length > 0 && names.indexOf(name) === index)
    .slice(0, 6)
    .map((actionName) => ({ actionName, label: actionName }));
  const manifest: CharacterManifest = {
    ...entry.manifest,
    shimejiGraph: {
      ...graph,
      defaultActions,
      menuActions,
    },
  };

  await writeJson(await characterManifestPath(characterId), manifest);
  await addCharacter({ ...entry, manifest });
}
