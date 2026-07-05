import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  COMPANION_BACKGROUND_MODES,
  type CompanionBackgroundMode,
} from "../types/companionBackground";

export const COMPANION_BACKGROUND_MODE_EVENT = "companion-background-mode";
const COMPANION_BACKGROUND_MODE_STORAGE_KEY = "tomoji-companion-background-mode";

export interface CompanionBackgroundModePayload {
  mode: CompanionBackgroundMode;
}

function isCompanionBackgroundMode(
  mode: string | null,
): mode is CompanionBackgroundMode {
  return COMPANION_BACKGROUND_MODES.includes(mode as CompanionBackgroundMode);
}

export function getCompanionBackgroundMode(): CompanionBackgroundMode {
  try {
    const stored = localStorage.getItem(COMPANION_BACKGROUND_MODE_STORAGE_KEY);
    return isCompanionBackgroundMode(stored) ? stored : "transparent";
  } catch {
    return "transparent";
  }
}

function storeCompanionBackgroundMode(mode: CompanionBackgroundMode): void {
  try {
    localStorage.setItem(COMPANION_BACKGROUND_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage failures; live broadcast still applies
  }
}

export async function emitCompanionBackgroundMode(
  mode: CompanionBackgroundMode,
): Promise<void> {
  storeCompanionBackgroundMode(mode);
  await emit(COMPANION_BACKGROUND_MODE_EVENT, {
    mode,
  } satisfies CompanionBackgroundModePayload);
}

export async function listenCompanionBackgroundMode(
  handler: (mode: CompanionBackgroundMode) => void,
): Promise<UnlistenFn> {
  return listen<CompanionBackgroundModePayload>(
    COMPANION_BACKGROUND_MODE_EVENT,
    (event) => {
      handler(event.payload.mode);
    },
  );
}
