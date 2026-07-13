import { useCallback, useState } from "react";
import type { DashboardTab } from "../types/dashboard";

interface UseDashboardTabResult {
  activeTab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
}

export function useDashboardTab(): UseDashboardTabResult {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");

  const setTab = useCallback((tab: DashboardTab) => {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
  }, [activeTab]);

  return { activeTab, setTab };
}
