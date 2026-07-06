import { openCharactersFolder } from "../../services/tomojiStorage";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useAutostart } from "../../hooks/useAutostart";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

export function SettingsView() {
  const { settings, isLoading, updateSettings } = useAppSettings();
  const {
    isAutostartEnabled,
    isLoading: isAutostartLoading,
    error: autostartError,
    setAutostartEnabled,
  } = useAutostart();

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-sm text-neutral-400">
          App preferences are saved on this device.
        </p>

        {isLoading || settings === null ? (
          <p className="mt-8 text-sm text-neutral-500">Loading settings…</p>
        ) : (
          <div className="mt-8 space-y-4">
            <SettingsSection
              title="Startup"
              description="Choose when Tomoji opens"
            >
              <SettingsToggleRow
                label="Start Tomoji when computer starts"
                description="Launch Tomoji automatically when you sign in"
                checked={isAutostartEnabled}
                disabled={isAutostartLoading}
                onChange={(checked) => void setAutostartEnabled(checked)}
              />
              {autostartError ? (
                <p className="mt-3 text-xs text-red-400">{autostartError}</p>
              ) : null}
            </SettingsSection>

            <SettingsSection
              title="Companion"
              description="How Tomojis behave when you open the app"
            >
              <SettingsToggleRow
                label="Restore companions on launch"
                description="Re-open enabled Tomoji windows when Tomoji starts"
                checked={settings.restoreCompanionsOnLaunch}
                onChange={(checked) =>
                  void updateSettings({ restoreCompanionsOnLaunch: checked })
                }
              />
              <SettingsToggleRow
                label="Confirm before deleting Tomojis"
                description="Ask before deleting an imported character from disk"
                checked={settings.confirmBeforeDelete}
                onChange={(checked) =>
                  void updateSettings({ confirmBeforeDelete: checked })
                }
              />
              <SettingsToggleRow
                label="Show helper tips"
                description="Keep short onboarding hints visible in Tomojis and edit screens"
                checked={settings.showHelperTips}
                onChange={(checked) =>
                  void updateSettings({ showHelperTips: checked })
                }
              />
            </SettingsSection>

            <SettingsSection
              title="Account"
              description="Profile, email, and sign-in"
              comingSoon
            />

            <SettingsSection
              title="Subscription"
              description="Plan, billing, and upgrades"
              comingSoon
            />

            <SettingsSection
              title="Advanced"
              description="Local data and storage"
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openCharactersFolder()}
                  className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-white hover:text-white"
                >
                  Open Tomojis folder
                </button>
                <p className="text-xs text-neutral-500">
                  Character sprites and manifests live here on disk.
                </p>
              </div>
            </SettingsSection>
          </div>
        )}
      </div>
    </section>
  );
}
