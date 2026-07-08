import {
  ANIMATION_CATEGORIES,
  REQUIRED_ANIMATION_CATEGORIES,
  type AnimationCategory,
  type AnimationDefinition,
  type CharacterManifest,
} from "../types/character";
import { addCharacter, getCharacter } from "./characterLibrary";
import { characterDirPath, characterManifestPath } from "./fs/appPaths";
import { joinPath, toAssetUrl, writeJson } from "./fs/fileSystemAdapter";

export interface LegacyShimejiRemapData {
  manifest: CharacterManifest;
  sourceCategories: AnimationCategory[];
  mappings: Partial<Record<AnimationCategory, AnimationCategory>>;
  previewUrlsByCategory: Partial<Record<AnimationCategory, string[]>>;
  fpsByCategory: Partial<Record<AnimationCategory, number>>;
}

function hasFrames(definition?: AnimationDefinition): definition is AnimationDefinition {
  return (definition?.frames.length ?? 0) > 0;
}

function animationSignature(definition: AnimationDefinition | undefined): string {
  return definition ? JSON.stringify(definition) : "";
}

function resolveMappings(
  animations: Partial<Record<AnimationCategory, AnimationDefinition>>,
  sourceAnimations: Partial<Record<AnimationCategory, AnimationDefinition>>,
  sourceCategories: readonly AnimationCategory[],
): Partial<Record<AnimationCategory, AnimationCategory>> {
  const signatureToCategory = new Map<string, AnimationCategory>();
  for (const category of sourceCategories) {
    signatureToCategory.set(animationSignature(sourceAnimations[category]), category);
  }

  const mappings: Partial<Record<AnimationCategory, AnimationCategory>> = {};
  for (const category of ANIMATION_CATEGORIES) {
    const definition = animations[category];
    if (!hasFrames(definition)) {
      continue;
    }

    const matchingCategory = signatureToCategory.get(animationSignature(definition));
    if (matchingCategory) {
      mappings[category] = matchingCategory;
      continue;
    }

    if (sourceCategories.includes(category)) {
      mappings[category] = category;
    }
  }

  return mappings;
}

function validateMappings(
  mappings: Partial<Record<AnimationCategory, AnimationCategory>>,
): void {
  for (const category of REQUIRED_ANIMATION_CATEGORIES) {
    if (!mappings[category]) {
      throw new Error(`${category} must be mapped before saving`);
    }
  }
}

export async function loadLegacyShimejiRemapData(
  characterId: string,
): Promise<LegacyShimejiRemapData> {
  const entry = await getCharacter(characterId);
  if (!entry || entry.source !== "shimeji") {
    throw new Error("This is not a Shimeji import.");
  }
  if (entry.manifest.animationSystem === "shimejiGraph") {
    throw new Error("Graph Shimeji imports use the graph remapper.");
  }

  const sourceAnimations = entry.manifest.sourceAnimations ?? entry.manifest.animations;
  const sourceCategories = ANIMATION_CATEGORIES.filter((category) =>
    hasFrames(sourceAnimations[category]),
  );
  const characterDir = await characterDirPath(characterId);
  const previewUrlsByCategory: Partial<Record<AnimationCategory, string[]>> = {};
  const fpsByCategory: Partial<Record<AnimationCategory, number>> = {};

  for (const category of sourceCategories) {
    const definition = sourceAnimations[category];
    if (!definition) {
      continue;
    }

    fpsByCategory[category] = definition.fps;
    previewUrlsByCategory[category] = await Promise.all(
      definition.frames.map(async (frame) =>
        toAssetUrl(await joinPath(characterDir, frame.src)),
      ),
    );
  }

  return {
    manifest: entry.manifest,
    sourceCategories,
    mappings: resolveMappings(
      entry.manifest.animations,
      sourceAnimations,
      sourceCategories,
    ),
    previewUrlsByCategory,
    fpsByCategory,
  };
}

export async function saveLegacyShimejiRemapData(
  characterId: string,
  mappings: Partial<Record<AnimationCategory, AnimationCategory>>,
): Promise<void> {
  validateMappings(mappings);

  const entry = await getCharacter(characterId);
  if (!entry || entry.source !== "shimeji") {
    throw new Error("This is not a Shimeji import.");
  }

  const sourceAnimations = entry.manifest.sourceAnimations ?? entry.manifest.animations;
  const animations: CharacterManifest["animations"] = {};

  for (const category of ANIMATION_CATEGORIES) {
    const sourceCategory = mappings[category];
    if (!sourceCategory) {
      continue;
    }

    const sourceAnimation = sourceAnimations[sourceCategory];
    if (hasFrames(sourceAnimation)) {
      animations[category] = { ...sourceAnimation, frames: [...sourceAnimation.frames] };
    }
  }

  const manifest: CharacterManifest = {
    ...entry.manifest,
    animations,
    sourceAnimations,
  };

  await writeJson(await characterManifestPath(characterId), manifest);
  await addCharacter({ ...entry, manifest });
}
