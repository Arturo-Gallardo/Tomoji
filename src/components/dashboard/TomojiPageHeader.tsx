import type { ReactNode } from "react";
import { IslandIcon } from "../ui/IslandIcon";

interface TomojiPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  trailing?: ReactNode;
}

export function TomojiPageHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  trailing,
}: TomojiPageHeaderProps) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-3 sm:gap-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="island-button island-button--soft shrink-0 px-3 py-2 text-sm"
        >
          <IslandIcon name="back" className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
        <h1 className="text-xl font-extrabold tracking-[0.04em] text-island-ink sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="text-xs font-bold text-island-muted">{subtitle}</p>
        ) : null}
      </div>
      {trailing ? <div className="ml-auto min-w-0 shrink-0">{trailing}</div> : null}
    </div>
  );
}
