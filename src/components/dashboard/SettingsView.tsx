import { useAppSettings } from "../../hooks/useAppSettings";
import { useAutostart } from "../../hooks/useAutostart";
import { useCompanionBackgroundToggle } from "../../hooks/useCompanionBackgroundToggle";
import { openCharactersFolder } from "../../services/tomojiStorage";
import { IslandIcon } from "../ui/IslandIcon";
import { SettingsSection } from "./SettingsSection";
import { SettingsToggleRow } from "./SettingsToggleRow";

export function SettingsView() {
  const { settings, isLoading, updateSettings } = useAppSettings();
  const { mode: companionBackgroundMode, setMode: setCompanionBackgroundMode } =
    useCompanionBackgroundToggle();
  const {
    isAutostartEnabled,
    isLoading: isAutostartLoading,
    error: autostartError,
    setAutostartEnabled,
  } = useAutostart();

  return (
    <section className="island-scroll-region island-page-enter min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header>
          <h1 className="text-2xl font-extrabold tracking-[0.04em] text-island-ink sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-island-muted">
            Tune how Tomoji starts, remembers companions, and stores local files.
          </p>
        </header>

        {isLoading || settings === null ? (
          <div
            className="island-card mt-6 flex items-center gap-3 p-5 text-sm font-bold text-island-muted"
            role="status"
            aria-live="polite"
          >
            <span className="h-3 w-3 animate-pulse rounded-full bg-island-orange" />
            Loading settings…
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <SettingsSection
              title="Startup"
              description="Choose when Tomoji opens"
              icon="restore"
            >
              <SettingsToggleRow
                label="Start Tomoji when computer starts"
                description="Launch Tomoji automatically when you sign in"
                checked={isAutostartEnabled}
                disabled={isAutostartLoading}
                onChange={(checked) => void setAutostartEnabled(checked)}
              />
              {autostartError ? (
                <p
                  className="island-notice island-notice--error px-3 py-2.5 text-xs font-semibold"
                  role="alert"
                >
                  {autostartError}
                </p>
              ) : null}
            </SettingsSection>

            <SettingsSection
              title="Companion"
              description="How Tomojis behave when you open the app"
              icon="tomoji"
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

            <div className="grid gap-5 md:grid-cols-2">
              <SettingsSection
                title="Account"
                description="Profile, email, and sign-in"
                icon="profile"
                comingSoon
              />

              <SettingsSection
                title="Subscription"
                description="Plan, billing, and upgrades"
                icon="sparkles"
                comingSoon
              />
            </div>

            <SettingsSection
              title="Advanced"
              description="Local data and storage"
              icon="folder"
            >
              <div className="island-form-section flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold text-island-ink">
                    Character files
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">
                    Character sprites and manifests live here on disk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openCharactersFolder()}
                  className="island-button island-button--soft shrink-0"
                >
                  <IslandIcon name="folder" className="h-4 w-4" />
                  Open Tomojis folder
                </button>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Debug"
              description="Temporary visual troubleshooting options"
              icon="settings"
            >
              <SettingsToggleRow
                label="Gray companion background"
                description="Show a gray background behind desktop companion windows"
                checked={companionBackgroundMode === "gray"}
                onChange={(checked) =>
                  setCompanionBackgroundMode(
                    checked ? "gray" : "transparent",
                  )
                }
              />
            </SettingsSection>
          </div>
        )}
      </div>
    </section>
  );
}
