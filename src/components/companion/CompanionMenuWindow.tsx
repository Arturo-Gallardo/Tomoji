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
import { IslandIcon } from "../ui/IslandIcon";

const ANIMATION_LABELS: Record<CompanionMenuAnimationAction, string> = {
  sit: "Sit",
  sitAlt: "Sit (alt 1)",
  sitAlt2: "Lie down",
  sitOnBar: "Sit on bar",
  dangleOnBar: "Dangle",
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
    <nav
      className="island-menu flex max-h-full w-full flex-col gap-0.5 overflow-y-auto p-1.5"
      aria-label="Tomoji actions"
    >
      <button
        type="button"
        aria-pressed={muted}
        onClick={() => {
          handleAction("toggleMute");
        }}
        className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
      >
        <IslandIcon name="mute" className="h-4 w-4 shrink-0" />
        {muted ? "Unmute" : "Mute"}
      </button>

      {travelItems.map((item) => (
        <button
          key={item.action}
          type="button"
          onClick={() => {
            handleAction(item.action);
          }}
          className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
        >
          <IslandIcon name="walk" className="h-4 w-4 shrink-0" />
          {item.label}
        </button>
      ))}

      {!wallLocked && !undersideLocked ? (
        <button
          type="button"
          onClick={() => {
            handleAction("turnAround");
          }}
          className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
        >
          <IslandIcon name="turn" className="h-4 w-4 shrink-0" />
          Turn around
        </button>
      ) : null}

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
            className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
          >
            <IslandIcon name="sparkles" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">Animations</span>
            <span className="text-[10px] font-black text-[var(--color-island-muted)]">
              {animationsOpen ? "▲" : "▼"}
            </span>
          </button>

          {animationsOpen && (
            <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l-2 border-[rgba(24,52,79,0.18)] pl-1.5">
              {animationItems.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    handleAction(item.action);
                  }}
                  className="island-menu-item !min-h-7 px-1.5 py-1 text-left text-[11px] font-bold"
                >
                  <IslandIcon name="sparkles" className="h-3.5 w-3.5 shrink-0" />
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
          handleAction("duplicate");
        }}
        className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
      >
        <IslandIcon name="duplicate" className="h-4 w-4 shrink-0" />
        Duplicate
      </button>

      <button
        type="button"
        aria-pressed={frozen}
        onClick={() => {
          handleAction("toggleFreeze");
        }}
        className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold"
      >
        <IslandIcon name="freeze" className="h-4 w-4 shrink-0" />
        {frozen ? "Unfreeze" : "Freeze"}
      </button>

      <button
        type="button"
        onClick={() => {
          handleAction("turnOff");
        }}
        className="island-menu-item !min-h-8 px-2 py-1 text-left text-xs font-extrabold !text-[#9b332c] hover:!bg-[#f8d5d8]"
      >
        <IslandIcon name="close" className="h-4 w-4 shrink-0" />
        Turn off
      </button>
    </nav>
  );
}
