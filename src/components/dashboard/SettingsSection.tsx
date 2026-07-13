import type { ReactNode } from "react";
import {
  IslandIcon,
  type IslandIconName,
} from "../ui/IslandIcon";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children?: ReactNode;
  comingSoon?: boolean;
  icon?: IslandIconName;
}

export function SettingsSection({
  title,
  description,
  children,
  comingSoon = false,
  icon,
}: SettingsSectionProps) {
  return (
    <section
      className={`island-card p-5 sm:p-6 ${comingSoon ? "border-dashed" : ""}`}
      aria-disabled={comingSoon || undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-custard">
              <IslandIcon name={icon} className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-island-ink sm:text-lg">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm font-medium leading-relaxed text-island-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {comingSoon ? (
          <span className="island-badge shrink-0 border-dashed">
            Coming soon
          </span>
        ) : null}
      </div>

      {children ? <div className="mt-5 space-y-3">{children}</div> : null}
    </section>
  );
}
