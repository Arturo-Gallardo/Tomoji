import { useEffect } from "react";
import { useCharactersFolderAutoSync } from "../../hooks/useCharactersFolderAutoSync";
import { useDashboardTab } from "../../hooks/useDashboardTab";
import { useCompanionBackgroundToggle } from "../../hooks/useCompanionBackgroundToggle";
import { useDashboardSelectedCompanion } from "../../hooks/useDashboardSelectedCompanion";
import { bootstrapCompanions } from "../../services/companionInstanceManager";
import { CompanionPreview } from "./CompanionPreview";
import { DashboardBackgroundToggle } from "./DashboardBackgroundToggle";
import { DashboardCompanionSwitcher } from "./DashboardCompanionSwitcher";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardOptionsPanel } from "./DashboardOptionsPanel";
import { SettingsView } from "./SettingsView";
import { TomojisView } from "./TomojisView";

export function DashboardShell() {
  const { activeTab, setTab } = useDashboardTab();
  const { mode, toggleLabel, cycleMode } = useCompanionBackgroundToggle();
  const {
    controllableInstances,
    selectedInstanceId,
    selectedInstance,
    setSelectedInstanceId,
    isLoading: isSelectionLoading,
  } = useDashboardSelectedCompanion();

  useCharactersFolderAutoSync();

  // spawn windows for enabled companions once when the dashboard opens
  useEffect(() => {
    void bootstrapCompanions();
  }, []);

  return (
    <main className="relative flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <DashboardHeader activeTab={activeTab} onTabChange={setTab} />

      {activeTab === "tomojis" ? (
        <TomojisView />
      ) : activeTab === "dashboard" ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DashboardCompanionSwitcher
            instances={controllableInstances}
            selectedInstanceId={selectedInstanceId}
            onSelect={setSelectedInstanceId}
          />

          {selectedInstanceId !== null && selectedInstance !== null ? (
            <div className="grid min-h-0 flex-1 grid-cols-2">
              <CompanionPreview instance={selectedInstance} />
              <DashboardOptionsPanel instance={selectedInstance} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {isSelectionLoading ? (
                <p className="text-sm text-neutral-500">Loading companions...</p>
              ) : (
                <div className="max-w-sm text-center">
                  <p className="text-sm font-bold text-white">
                    No companions on screen
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    Go to Tomojis, import a pack, then toggle a card on.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("tomojis")}
                    className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
                  >
                    Open Tomojis
                  </button>
                </div>
              )}
            </div>
          )}

          <DashboardBackgroundToggle
            mode={mode}
            label={toggleLabel}
            onCycle={cycleMode}
          />
        </div>
      ) : (
        <SettingsView />
      )}

    </main>
  );
}
