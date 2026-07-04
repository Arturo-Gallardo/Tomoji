import { useEffect } from "react";
import {
  listenTargetPickerSelected,
  listenWalkPickerCancel,
} from "../services/companionWalkPickerApi";

interface UseCompanionWalkPickerEventsOptions {
  onSelectWalkTarget: (anchorX: number) => void;
  onSelectCrawlTarget: (anchorX: number) => void;
  onSelectClimbTarget: (anchorY: number) => void;
  onCancel: () => void;
}

export function useCompanionWalkPickerEvents({
  onSelectWalkTarget,
  onSelectCrawlTarget,
  onSelectClimbTarget,
  onCancel,
}: UseCompanionWalkPickerEventsOptions): void {
  useEffect(() => {
    let unlistenSelect: (() => void) | undefined;
    let unlistenCancel: (() => void) | undefined;

    void listenTargetPickerSelected(({ mode, anchorX, anchorY }) => {
      if (mode === "climb") {
        onSelectClimbTarget(anchorY);
        return;
      }

      if (mode === "crawl") {
        onSelectCrawlTarget(anchorX);
        return;
      }

      onSelectWalkTarget(anchorX);
    }).then((cleanup) => {
      unlistenSelect = cleanup;
    });

    void listenWalkPickerCancel(() => {
      onCancel();
    }).then((cleanup) => {
      unlistenCancel = cleanup;
    });

    return () => {
      unlistenSelect?.();
      unlistenCancel?.();
    };
  }, [
    onCancel,
    onSelectClimbTarget,
    onSelectCrawlTarget,
    onSelectWalkTarget,
  ]);
}
