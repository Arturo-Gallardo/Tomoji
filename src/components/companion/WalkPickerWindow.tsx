import { useEffect, useState } from "react";
import {
  cancelWalkPicker,
  listenTargetPickerOpen,
  submitTargetPicker,
} from "../../services/companionWalkPickerApi";
import type { TargetPickerMode } from "../../types/companionMenu";
import { toPhysicalScreenPosition } from "../../utils/screenCoordinates";

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

  return (
    <div
      role="presentation"
      className={`h-full w-full bg-black/10 ${cursorClass}`}
      onPointerDown={(event) => {
        void handlePointerDown(event);
      }}
    />
  );
}
