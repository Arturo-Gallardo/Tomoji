import { useCallback, useState } from "react";
import {
  emitCompanionBackgroundMode,
  getCompanionBackgroundMode,
} from "../services/companionBackground";
import type { CompanionBackgroundMode } from "../types/companionBackground";

interface UseCompanionBackgroundToggleResult {
  mode: CompanionBackgroundMode;
  setMode: (mode: CompanionBackgroundMode) => void;
}

export function useCompanionBackgroundToggle(): UseCompanionBackgroundToggleResult {
  const [mode, setMode] = useState<CompanionBackgroundMode>(
    getCompanionBackgroundMode,
  );

  const setBackgroundMode = useCallback((nextMode: CompanionBackgroundMode) => {
    setMode(nextMode);
    void emitCompanionBackgroundMode(nextMode);
  }, []);

  return {
    mode,
    setMode: setBackgroundMode,
  };
}
