import { useCallback, useState } from "react";
import {
  emitCompanionBackgroundMode,
  getCompanionBackgroundMode,
} from "../services/companionBackground";
import type { CompanionBackgroundMode } from "../types/companionBackground";

interface UseCompanionBackgroundToggleResult {
  mode: CompanionBackgroundMode;
  toggleLabel: string;
  cycleMode: () => void;
}

// debug-only dashboard toggle; persisted globally so new companion windows match
export function useCompanionBackgroundToggle(): UseCompanionBackgroundToggleResult {
  const [mode, setMode] = useState<CompanionBackgroundMode>(
    getCompanionBackgroundMode,
  );

  const cycleMode = useCallback(() => {
    const nextMode: CompanionBackgroundMode =
      mode === "transparent" ? "gray" : "transparent";

    setMode(nextMode);
    void emitCompanionBackgroundMode(nextMode);
  }, [mode]);

  const toggleLabel = mode === "transparent" ? "Gray bg" : "Clear bg";

  return {
    mode,
    toggleLabel,
    cycleMode,
  };
}
