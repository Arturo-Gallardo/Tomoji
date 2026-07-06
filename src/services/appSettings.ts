import { emit } from "@tauri-apps/api/event";
import type { AppSettings } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import { settingsFilePath } from "./fs/appPaths";
import { pathExists, readJson, writeJson } from "./fs/fileSystemAdapter";

export const APP_SETTINGS_EVENT = "app-settings-changed";

interface SettingsFile {
  version: number;
  settings: Partial<AppSettings>;
}

const SETTINGS_VERSION = 1;

export function normalizeAppSettings(
  settings: Partial<AppSettings> | undefined,
): AppSettings {
  return {
    restoreCompanionsOnLaunch:
      settings?.restoreCompanionsOnLaunch ??
      DEFAULT_APP_SETTINGS.restoreCompanionsOnLaunch,
    confirmBeforeDelete:
      settings?.confirmBeforeDelete ?? DEFAULT_APP_SETTINGS.confirmBeforeDelete,
    showHelperTips:
      settings?.showHelperTips ?? DEFAULT_APP_SETTINGS.showHelperTips,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const path = await settingsFilePath();
  if (!(await pathExists(path))) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const file = await readJson<SettingsFile>(path);
    return normalizeAppSettings(file.settings);
  } catch (error) {
    console.error("failed to read app settings", error);
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function updateAppSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = normalizeAppSettings({ ...current, ...patch });
  const file: SettingsFile = { version: SETTINGS_VERSION, settings: next };

  await writeJson(await settingsFilePath(), file);
  await emit(APP_SETTINGS_EVENT, next);
  return next;
}
