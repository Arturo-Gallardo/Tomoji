import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState } from "react";
import {
  emitCompanionMenuAction,
  hideCompanionMenu,
  listenCompanionMenuConfig,
  resizeCompanionMenu,
} from "../../services/companionMenuApi";
import type {
  CompanionMenuAction,
  CompanionMenuAnimationAction,
} from "../../types/companionMenu";

const ANIMATION_LABELS: Record<CompanionMenuAnimationAction, string> = {
  sit: "Sit",
  sitAlt: "Sit (alt 1)",
  sitAlt2: "Sit (alt 2)",
  emote: "Emote 1",
  emote2: "Emote 2",
  emote3: "Emote 3",
  emote4: "Emote 4",
  emote5: "Emote 5",
  emote6: "Emote 6",
};

function isEmoteAction(
  action: CompanionMenuAnimationAction,
): action is Extract<CompanionMenuAnimationAction, `emote${string}` | "emote"> {
  return action.startsWith("emote");
}

function animationLabel(
  action: CompanionMenuAnimationAction,
  availableActions: readonly CompanionMenuAnimationAction[],
): string {
  if (!isEmoteAction(action)) {
    return ANIMATION_LABELS[action];
  }

  const emoteIndex = availableActions
    .filter(isEmoteAction)
    .indexOf(action);

  return `Emote ${emoteIndex + 1}`;
}

export function CompanionMenuWindow() {
  const [wallLocked, setWallLocked] = useState(false);
  const [undersideLocked, setUndersideLocked] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [canFloorCrawl, setCanFloorCrawl] = useState(false);
  const [animationsOpen, setAnimationsOpen] = useState(false);
  const [availableActions, setAvailableActions] = useState<
    CompanionMenuAnimationAction[]
  >([]);
  // companion window the chosen action should be routed back to
  const [targetLabel, setTargetLabel] = useState<string | null>(null);

  useEffect(() => {
    let unlistenFocus: (() => void) | undefined;
    let unlistenConfig: (() => void) | undefined;

    void getCurrentWebviewWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          void hideCompanionMenu();
        }
      })
      .then((cleanup) => {
        unlistenFocus = cleanup;
      });

    void listenCompanionMenuConfig(
      ({
        wallLocked: nextWallLocked,
        undersideLocked: nextUndersideLocked,
        frozen: nextFrozen,
        muted: nextMuted,
        canFloorCrawl: nextCanFloorCrawl = false,
        availableActions: nextAvailableActions = [],
        targetLabel: nextTarget,
      }) => {
        setWallLocked(nextWallLocked);
        setUndersideLocked(nextUndersideLocked);
        setFrozen(nextFrozen);
        setMuted(nextMuted);
        setCanFloorCrawl(nextCanFloorCrawl);
        setAnimationsOpen(false);
        setAvailableActions(nextAvailableActions);
        setTargetLabel(nextTarget);
      },
    ).then((cleanup) => {
      unlistenConfig = cleanup;
    });

    return () => {
      unlistenFocus?.();
      unlistenConfig?.();
    };
  }, []);

  const travelItems = undersideLocked
    ? [{ action: "crawlTo" as const, label: "Crawl to..." }]
    : wallLocked
      ? [{ action: "climbTo" as const, label: "Climb to..." }]
      : [
          { action: "walkTo" as const, label: "Walk to..." },
          ...(canFloorCrawl
            ? [{ action: "floorCrawlTo" as const, label: "Crawl to..." }]
            : []),
        ];

  const animationItems =
    wallLocked || undersideLocked
      ? []
      : availableActions.map((action) => ({
          action,
          label: animationLabel(action, availableActions),
        }));

  const handleAction = (action: CompanionMenuAction) => {
    if (targetLabel === null) {
      return;
    }

    void hideCompanionMenu().then(() => {
      void emitCompanionMenuAction(targetLabel, action);
    });
  };

  return (
    <nav className="flex max-h-full w-full flex-col gap-1 overflow-y-auto rounded-md border border-neutral-600/90 bg-neutral-900/95 p-1.5 shadow-lg">
      <button
        type="button"
        onClick={() => {
          handleAction("toggleMute");
        }}
        className="rounded px-2.5 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-700/90"
      >
        {muted ? "Unmute" : "Mute"}
      </button>

      {travelItems.map((item) => (
        <button
          key={item.action}
          type="button"
          onClick={() => {
            handleAction(item.action);
          }}
          className="rounded px-2.5 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-700/90"
        >
          {item.label}
        </button>
      ))}

      <button
        type="button"
        onClick={() => {
          handleAction("turnAround");
        }}
        className="rounded px-2.5 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-700/90"
      >
        Turn around
      </button>

      {animationItems.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={animationsOpen}
            onClick={() => {
              setAnimationsOpen((open) => {
                const expanded = !open;
                void resizeCompanionMenu(
                  expanded,
                  animationItems.length,
                  canFloorCrawl ? 1 : 0,
                );
                return expanded;
              });
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-700/90"
          >
            <span>Animations</span>
            <span className="text-xs text-neutral-400">
              {animationsOpen ? "▲" : "▼"}
            </span>
          </button>

          {animationsOpen && (
            <div className="mt-1 flex flex-col gap-1 border-l border-neutral-700 pl-2">
              {animationItems.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    handleAction(item.action);
                  }}
                  className="rounded px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700/90"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          handleAction("toggleFreeze");
        }}
        className="rounded px-2.5 py-1.5 text-left text-sm text-neutral-100 hover:bg-neutral-700/90"
      >
        {frozen ? "Unfreeze" : "Freeze"}
      </button>

      <button
        type="button"
        onClick={() => {
          handleAction("turnOff");
        }}
        className="rounded px-2.5 py-1.5 text-left text-sm text-red-300 hover:bg-red-950/70"
      >
        Turn off
      </button>
    </nav>
  );
}
