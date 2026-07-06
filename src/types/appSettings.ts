export interface AppSettings {
  restoreCompanionsOnLaunch: boolean;
  confirmBeforeDelete: boolean;
  showHelperTips: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  restoreCompanionsOnLaunch: true,
  confirmBeforeDelete: true,
  showHelperTips: true,
};
