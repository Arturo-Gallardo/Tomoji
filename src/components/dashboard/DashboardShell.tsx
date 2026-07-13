import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCharactersFolderAutoSync } from "../../hooks/useCharactersFolderAutoSync";
import { useDashboardTab } from "../../hooks/useDashboardTab";
import { useDashboardSelectedCompanion } from "../../hooks/useDashboardSelectedCompanion";
import { bootstrapCompanions } from "../../services/companionInstanceManager";
import { CompanionPreview } from "./CompanionPreview";
import { DashboardCompanionSwitcher } from "./DashboardCompanionSwitcher";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardOptionsPanel } from "./DashboardOptionsPanel";
import { SettingsView } from "./SettingsView";
import { TomojisView } from "./TomojisView";

export function DashboardShell() {
  const { activeTab, setTab } = useDashboardTab();
  const reduceMotion = useReducedMotion();
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
    <main className="island-shell relative flex h-screen flex-col overflow-hidden">
      <DashboardHeader activeTab={activeTab} onTabChange={setTab} />

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -16 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }
          }
          className="flex min-h-0 flex-1"
        >
          {activeTab === "tomojis" ? (
            <TomojisView />
          ) : activeTab === "dashboard" ? (
        <section className="island-scroll-region island-page-enter min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-[0.04em] text-island-ink sm:text-3xl">
                  Who’s hanging out?
                </h1>
                <p className="mt-1 max-w-xl text-sm font-medium text-island-muted">
                  Choose a Tomoji, see what they are doing, and use quick controls.
                </p>
              </div>
            </div>

            <DashboardCompanionSwitcher
              instances={controllableInstances}
              selectedInstanceId={selectedInstanceId}
              onSelect={setSelectedInstanceId}
            />

            {selectedInstanceId !== null && selectedInstance !== null ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <CompanionPreview instance={selectedInstance} />
                <DashboardOptionsPanel instance={selectedInstance} />
              </div>
            ) : (
              <div className="island-card my-auto flex min-h-72 items-center justify-center p-8">
                {isSelectionLoading ? (
                  <div className="text-center" role="status" aria-live="polite">
                    <span className="mx-auto mb-3 block h-12 w-12 animate-pulse rounded-full bg-island-custard" />
                    <p className="text-sm font-bold text-island-muted">Gathering companions…</p>
                  </div>
                ) : (
                  <div className="max-w-sm text-center">
                    <svg
                      viewBox="0 0 64 64"
                      className="mx-auto mb-5 h-16 w-16 text-island-ink"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <circle cx="32" cy="32" r="27" />
                      <circle cx="23" cy="26" r="1.5" fill="currentColor" />
                      <circle cx="41" cy="26" r="1.5" fill="currentColor" />
                      <path d="M21 44c3-6 19-6 22 0" />
                    </svg>
                    <p className="text-lg font-extrabold text-island-ink">
                      It feels quiet here
                    </p>
                    <p className="mt-2 text-sm font-medium text-island-muted">
                      Turn on a Tomoji from your roster to invite them here.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("tomojis")}
                      className="island-button island-button--primary mt-5"
                    >
                      Open Tomojis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
          ) : (
            <SettingsView />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
