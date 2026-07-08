import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPANION_REGISTRY_EVENT,
  addInstance,
  archiveInstance,
  readCompanionInstances,
  reconcileTomojiRegistry,
  removeInstance,
  reorderActiveInstances,
  setActiveInstancesEnabled,
  setInstanceEnabled,
  unarchiveInstance,
  updateInstance,
} from "../services/companionInstanceManager";
import type { CompanionInstance } from "../types/companionInstance";

interface UseCompanionInstancesResult {
  instances: CompanionInstance[];
  activeInstances: CompanionInstance[];
  archivedInstances: CompanionInstance[];
  isLoading: boolean;
  addCompanion: (characterId: string, name?: string) => Promise<void>;
  removeCompanion: (id: string) => Promise<void>;
  toggleCompanion: (id: string, enabled: boolean) => Promise<void>;
  setAllActiveCompanionsEnabled: (enabled: boolean) => Promise<void>;
  updateCompanion: (
    id: string,
    patch: Partial<Omit<CompanionInstance, "id">>,
  ) => Promise<void>;
  archiveCompanion: (id: string) => Promise<void>;
  unarchiveCompanion: (id: string) => Promise<void>;
  reorderCompanions: (orderedActiveIds: string[]) => Promise<void>;
  refreshFromDisk: () => Promise<void>;
}

// dashboard-facing view of the companion registry. stays in sync with the
// persisted instances.json via the registry-changed broadcast.
export function useCompanionInstances(): UseCompanionInstancesResult {
  const [instances, setInstances] = useState<CompanionInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const refresh = async () => {
      const next = await readCompanionInstances();
      if (!cancelled) {
        setInstances(next);
      }
    };

    void (async () => {
      const stopListening = await listen(COMPANION_REGISTRY_EVENT, () => {
        void refresh();
      });
      if (cancelled) {
        stopListening();
        return;
      }
      unlisten = stopListening;

      await refresh();
      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const addCompanion = useCallback(
    async (characterId: string, name?: string) => {
      await addInstance(characterId, name);
    },
    [],
  );

  const removeCompanion = useCallback(async (id: string) => {
    await removeInstance(id);
  }, []);

  const toggleCompanion = useCallback(async (id: string, enabled: boolean) => {
    await setInstanceEnabled(id, enabled);
  }, []);

  const setAllActiveCompanionsEnabled = useCallback(async (enabled: boolean) => {
    await setActiveInstancesEnabled(enabled);
  }, []);

  const updateCompanion = useCallback(
    async (id: string, patch: Partial<Omit<CompanionInstance, "id">>) => {
      await updateInstance(id, patch);
    },
    [],
  );

  const archiveCompanion = useCallback(async (id: string) => {
    await archiveInstance(id);
  }, []);

  const unarchiveCompanion = useCallback(async (id: string) => {
    await unarchiveInstance(id);
  }, []);

  const reorderCompanions = useCallback(async (orderedActiveIds: string[]) => {
    await reorderActiveInstances(orderedActiveIds);
  }, []);

  const refreshFromDisk = useCallback(async () => {
    await reconcileTomojiRegistry({ refreshEnabled: true });
  }, []);

  const activeInstances = useMemo(
    () =>
      instances.filter(
        (instance) => !instance.archived && !instance.isTemporaryClone,
      ),
    [instances],
  );

  const archivedInstances = useMemo(
    () =>
      instances.filter(
        (instance) => instance.archived && !instance.isTemporaryClone,
      ),
    [instances],
  );

  return useMemo(
    () => ({
      instances,
      activeInstances,
      archivedInstances,
      isLoading,
      addCompanion,
      removeCompanion,
      toggleCompanion,
      setAllActiveCompanionsEnabled,
      updateCompanion,
      archiveCompanion,
      unarchiveCompanion,
      reorderCompanions,
      refreshFromDisk,
    }),
    [
      activeInstances,
      addCompanion,
      archiveCompanion,
      archivedInstances,
      instances,
      isLoading,
      removeCompanion,
      reorderCompanions,
      refreshFromDisk,
      setAllActiveCompanionsEnabled,
      toggleCompanion,
      unarchiveCompanion,
      updateCompanion,
    ],
  );
}
