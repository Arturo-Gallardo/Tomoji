import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import {
  buildAnimationRegistry,
  type AnimationRegistry,
} from "../services/animationRegistry";
import {
  CHARACTER_LIBRARY_EVENT,
  getCharacter,
} from "../services/characterLibrary";

interface RegistryCacheEntry {
  registry?: AnimationRegistry;
  promise?: Promise<AnimationRegistry | null>;
}

const registryCache = new Map<string, RegistryCacheEntry>();
const librarySubscribers = new Set<() => void>();
let libraryUnlisten: (() => void) | null = null;
let libraryListenerStarted = false;

async function loadRegistry(
  characterId: string,
): Promise<AnimationRegistry | null> {
  const cached = registryCache.get(characterId);
  if (cached?.registry) {
    return cached.registry;
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = (async () => {
    const character = await getCharacter(characterId);
    if (character === null) {
      return null;
    }

    return buildAnimationRegistry(character);
  })();

  registryCache.set(characterId, { promise });

  try {
    const registry = await promise;
    const latest = registryCache.get(characterId);
    if (latest?.promise === promise) {
      if (registry === null) {
        registryCache.delete(characterId);
      } else {
        registryCache.set(characterId, { registry });
      }
    }
    return registry;
  } catch (error) {
    if (registryCache.get(characterId)?.promise === promise) {
      registryCache.delete(characterId);
    }
    throw error;
  }
}

function notifyLibraryChanged(): void {
  registryCache.clear();
  for (const notify of librarySubscribers) {
    notify();
  }
}

function ensureLibraryListener(): void {
  if (libraryListenerStarted) {
    return;
  }

  libraryListenerStarted = true;
  void listen(CHARACTER_LIBRARY_EVENT, notifyLibraryChanged)
    .then((unlisten) => {
      if (librarySubscribers.size === 0) {
        unlisten();
        libraryListenerStarted = false;
        return;
      }

      libraryUnlisten = unlisten;
    })
    .catch(() => {
      libraryListenerStarted = false;
    });
}

function subscribeLibraryChanged(onChange: () => void): () => void {
  librarySubscribers.add(onChange);
  ensureLibraryListener();

  return () => {
    librarySubscribers.delete(onChange);
    if (librarySubscribers.size === 0 && libraryUnlisten) {
      libraryUnlisten();
      libraryUnlisten = null;
      libraryListenerStarted = false;
    }
  };
}

// loads the animation registry for a character id (dashboard preview, etc.)
export function useCharacterAnimationRegistry(
  characterId: string | undefined,
): AnimationRegistry | null {
  const [cacheVersion, setCacheVersion] = useState(0);
  const [registry, setRegistry] = useState<AnimationRegistry | null>(
    () => characterId ? registryCache.get(characterId)?.registry ?? null : null,
  );

  useEffect(
    () => subscribeLibraryChanged(() => setCacheVersion((version) => version + 1)),
    [],
  );

  useEffect(() => {
    if (characterId === undefined) {
      setRegistry(null);
      return;
    }

    let cancelled = false;
    setRegistry(registryCache.get(characterId)?.registry ?? null);

    void (async () => {
      const next = await loadRegistry(characterId);

      if (!cancelled) {
        setRegistry(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheVersion, characterId]);

  return registry;
}
