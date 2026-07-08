import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompanionInstances } from "./useCompanionInstances";
import type { CompanionInstance } from "../types/companionInstance";

const STORAGE_KEY = "tomoji-dashboard-selected-companion";

function readStoredSelection(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSelection(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function pickDefaultInstance(instances: CompanionInstance[]): string | null {
  if (instances.length === 0) {
    return null;
  }

  return instances.find((instance) => instance.id === "default")?.id ?? instances[0]?.id ?? null;
}

interface UseDashboardSelectedCompanionResult {
  instances: CompanionInstance[];
  controllableInstances: CompanionInstance[];
  selectedInstanceId: string | null;
  selectedInstance: CompanionInstance | null;
  setSelectedInstanceId: (id: string) => void;
  isLoading: boolean;
}

export function useDashboardSelectedCompanion(): UseDashboardSelectedCompanionResult {
  const { instances, isLoading } = useCompanionInstances();
  const [selectedInstanceId, setSelectedInstanceIdState] = useState<string | null>(
    readStoredSelection,
  );

  const controllableInstances = useMemo(
    () =>
      instances.filter((instance) => instance.enabled && !instance.archived),
    [instances],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (controllableInstances.length === 0) {
      setSelectedInstanceIdState(null);
      return;
    }

    if (
      selectedInstanceId !== null &&
      controllableInstances.some((instance) => instance.id === selectedInstanceId)
    ) {
      return;
    }

    const fallback = pickDefaultInstance(controllableInstances);
    if (fallback !== null) {
      setSelectedInstanceIdState(fallback);
      writeStoredSelection(fallback);
    }
  }, [controllableInstances, isLoading, selectedInstanceId]);

  const setSelectedInstanceId = useCallback((id: string) => {
    setSelectedInstanceIdState(id);
    writeStoredSelection(id);
  }, []);

  const selectedInstance = useMemo(
    () =>
      controllableInstances.find((instance) => instance.id === selectedInstanceId) ??
      null,
    [controllableInstances, selectedInstanceId],
  );

  return {
    instances,
    controllableInstances,
    selectedInstanceId,
    selectedInstance,
    setSelectedInstanceId,
    isLoading,
  };
}
