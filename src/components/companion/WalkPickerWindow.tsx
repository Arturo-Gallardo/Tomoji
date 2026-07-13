import { useEffect, useState } from "react";
import {
  cancelWalkPicker,
  listenTargetPickerOpen,
  submitTargetPicker,
} from "../../services/companionWalkPickerApi";
import type { TargetPickerMode } from "../../types/companionMenu";
import { toPhysicalScreenPosition } from "../../utils/screenCoordinates";
import { IslandIcon } from "../ui/IslandIcon";

export function WalkPickerWindow() {
  const [mode, setMode] = useState<TargetPickerMode>("walk");
  // the companion window that opened this picker; picker results route back to it
  const [targetLabel, setTargetLabel] = useState<string | null>(null);

  useEffect(() => {
    let unlistenOpen: (() => void) | undefined;

    void listenTargetPickerOpen(({ mode: nextMode, targetLabel: nextTarget }) => {
      setMode(nextMode);
      setTargetLabel(nextTarget);
    }).then((cleanup) => {
      unlistenOpen = cleanup;
    });

    return () => {
      unlistenOpen?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && targetLabel !== null) {
        void cancelWalkPicker(targetLabel);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [targetLabel]);

  const handlePointerDown = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (targetLabel === null) {
      return;
    }

    if (event.button !== 0) {
      if (event.button === 2) {
        void cancelWalkPicker(targetLabel);
      }
      return;
    }

    const pointer = toPhysicalScreenPosition(event.screenX, event.screenY);

    if (mode === "climb") {
      void submitTargetPicker(targetLabel, "climb", 0, pointer.y);
      return;
    }

    void submitTargetPicker(
      targetLabel,
      mode === "crawl" || mode === "floorCrawl" ? mode : "walk",
      pointer.x,
      0,
    );
  };

  const cursorClass =
    mode === "climb"
      ? "cursor-ns-resize"
      : mode === "crawl" || mode === "floorCrawl"
        ? "cursor-ew-resize"
        : "cursor-crosshair";
  const pickerTitle =
    mode === "climb"
      ? "Choose a climb height"
      : mode === "crawl" || mode === "floorCrawl"
        ? "Choose a crawl spot"
        : "Choose a walking spot";
  const pickerHint =
    mode === "climb"
      ? "Click at the height Tomoji should climb to."
      : "Click where Tomoji should travel.";

  return (
    <div
      role="presentation"
      className={`relative h-full w-full bg-[#f6c84a]/15 ${cursorClass}`}
      onPointerDown={(event) => {
        void handlePointerDown(event);
      }}
    >
      <div className="pointer-events-none absolute left-1/2 top-6 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2">
        <div className="island-card flex items-center gap-3 px-4 py-3 text-[var(--color-island-ink)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-island-ink)] bg-[var(--color-island-custard)]">
            <IslandIcon name="walk" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">{pickerTitle}</span>
            <span className="mt-0.5 block text-xs font-semibold text-[var(--color-island-muted)]">
              {pickerHint} Right-click or press Esc to cancel.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
