import { useEffect, useState } from "react";
import { getCharacter } from "../services/characterLibrary";
import { characterDirPath } from "../services/fs/appPaths";
import { joinPath, toAssetUrl } from "../services/fs/fileSystemAdapter";
import type { ShimejiAnimationGraph } from "../types/shimejiGraph";

const previewCache = new Map<string, string | null>();
const previewPromises = new Map<string, Promise<string | null>>();

function firstGraphPoseSrc(
  actionName: string,
  graph: ShimejiAnimationGraph,
  seen = new Set<string>(),
): string | null {
  if (seen.has(actionName)) {
    return null;
  }
  seen.add(actionName);

  const action = graph.actions[actionName];
  if (!action) {
    return null;
  }
  if (action.poses[0]?.src) {
    return action.poses[0].src;
  }

  for (const reference of action.references) {
    const src = firstGraphPoseSrc(reference.name, graph, seen);
    if (src) {
      return src;
    }
  }

  return null;
}

async function loadIdlePreview(characterId: string): Promise<string | null> {
  const cached = previewCache.get(characterId);
  if (cached !== undefined) {
    return cached;
  }

  const pending = previewPromises.get(characterId);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    const character = await getCharacter(characterId);
    if (!character) {
      return null;
    }

    const { manifest } = character;
    const src = manifest.shimejiGraph
      ? firstGraphPoseSrc(
          manifest.shimejiGraph.defaultActions.idle ?? "",
          manifest.shimejiGraph,
        )
      : manifest.animations.idle?.frames[0]?.src ?? null;
    if (!src) {
      return null;
    }

    const folderPath = character.folderPath ?? await characterDirPath(characterId);
    return toAssetUrl(await joinPath(folderPath, src));
  })();
  previewPromises.set(characterId, promise);

  try {
    const preview = await promise;
    previewCache.set(characterId, preview);
    return preview;
  } finally {
    previewPromises.delete(characterId);
  }
}

export function useCharacterIdlePreview(characterId: string): string | null {
  const [preview, setPreview] = useState<string | null>(
    () => previewCache.get(characterId) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    setPreview(previewCache.get(characterId) ?? null);
    void loadIdlePreview(characterId).then((next) => {
      if (!cancelled) {
        setPreview(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  return preview;
}
