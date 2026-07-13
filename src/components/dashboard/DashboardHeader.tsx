import { motion, useReducedMotion } from "framer-motion";
import type { DashboardTab } from "../../types/dashboard";
import { IslandIcon, type IslandIconName } from "../ui/IslandIcon";

interface DashboardHeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onAccountToggle: () => void;
}

type NavItemProps = {
  icon: IslandIconName;
  label: string;
  tab: DashboardTab;
  activeTab: DashboardTab;
  reduceMotion: boolean | null;
  disabled?: boolean;
  onTabChange: (tab: DashboardTab) => void;
};

function NavItem({
  icon,
  label,
  tab,
  activeTab,
  reduceMotion,
  disabled = false,
  onTabChange,
}: NavItemProps) {
  const isActive = activeTab === tab;
  const baseClass = "island-nav-item";

  if (disabled) {
    return (
      <span className={`${baseClass} cursor-default opacity-70`} aria-disabled="true">
        <IslandIcon name={icon} className="h-4 w-4" />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onTabChange(tab)}
      className={`${baseClass} relative hover:opacity-90`}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive ? (
        <motion.span
          layoutId="dashboard-active-tab"
          className="pointer-events-none absolute inset-0 rounded-[0.65rem] border-2 border-island-sun-deep bg-island-orange shadow-[inset_0_-2px_0_rgba(112,75,20,0.16)]"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 480, damping: 32 }
          }
        />
      ) : null}
      <span className="relative z-10 flex items-center gap-2">
        <IslandIcon name={icon} className="h-4 w-4" />
        {label}
      </span>
    </button>
  );
}

export function DashboardHeader({
  activeTab,
  onTabChange,
  onAccountToggle,
}: DashboardHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="island-topbar shrink-0">
      <div className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/60 bg-island-sun shadow-[0_2px_0_rgba(24,52,79,0.16)]">
            <IslandIcon name="sparkles" className="h-5 w-5" />
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-extrabold text-island-ink">
              Tomoji
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-island-muted">
              Desktop companions
            </span>
          </span>
        </div>

        <nav className="island-nav" aria-label="Main">
          <NavItem
            icon="tomoji"
            label="Tomojis"
            tab="tomojis"
            activeTab={activeTab}
            reduceMotion={reduceMotion}
            onTabChange={onTabChange}
          />
          <NavItem
            icon="dashboard"
            label="Dashboard"
            tab="dashboard"
            activeTab={activeTab}
            reduceMotion={reduceMotion}
            onTabChange={onTabChange}
          />
          <NavItem
            icon="settings"
            label="Settings"
            tab="settings"
            activeTab={activeTab}
            reduceMotion={reduceMotion}
            onTabChange={onTabChange}
          />
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onTabChange("premium")}
            title="Premium"
            className={`island-icon-button h-10 w-10 ${
              activeTab === "premium" ? "island-button--primary" : "island-button--soft"
            }`}
            aria-current={activeTab === "premium" ? "page" : undefined}
            aria-label="Open Premium"
          >
            <IslandIcon name="crown" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onAccountToggle}
            title="Account"
            className="island-icon-button h-10 w-10"
            aria-label="Open account"
          >
            <IslandIcon name="profile" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
