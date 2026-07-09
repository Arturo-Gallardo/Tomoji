import type { ReactNode } from "react";
import type { BehaviorSettings, RandomSitAction } from "../../../types/character";

export type RandomBehaviorKey = Extract<
  keyof BehaviorSettings,
  | "allowRandomWalk"
  | "allowRandomFloorCrawl"
  | "allowRandomSit"
  | "allowRandomWallClimb"
  | "allowRandomCeilingCrawl"
  | "allowRandomDialogue"
>;

export type FrequencyKey = Extract<
  keyof BehaviorSettings,
  | "actionFrequency"
  | "walkFrequency"
  | "floorCrawlFrequency"
  | "sitFrequency"
  | "wallClimbFrequency"
  | "ceilingCrawlFrequency"
  | "dialogueFrequency"
>;

const RANDOM_SIT_OPTIONS: readonly {
  action: RandomSitAction;
  label: string;
  description: string;
}[] = [
  {
    action: "sit",
    label: "Primary",
    description: "main floor sit",
  },
  {
    action: "sitAlt",
    label: "Alt 1",
    description: "second sit slot",
  },
  {
    action: "sitAlt2",
    label: "Lie down",
    description: "lie down / sprawl slot",
  },
  {
    action: "sitOnBar",
    label: "Bar sit",
    description: "perched sit slot",
  },
  {
    action: "dangleOnBar",
    label: "Dangle",
    description: "dangling sit slot",
  },
];

interface AutonomySliderRowProps {
  label: string;
  description: string;
  enabled?: boolean;
  disabled?: boolean;
  frequency: number;
  controlLabel?: string;
  valueLabel?: string;
  onToggle?: (enabled: boolean) => void;
  onFrequencyChange: (frequency: number) => void;
  children?: ReactNode;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function rateLabel(value: number): string {
  if (value <= 0) {
    return "Off";
  }
  if (value < 0.25) {
    return "Rare";
  }
  if (value < 0.5) {
    return "Slow";
  }
  if (value < 0.8) {
    return "Normal";
  }
  return "Fast";
}

function weightLabel(value: number): string {
  return `${value.toFixed(2)}x`;
}

function AutonomySliderRow({
  label,
  description,
  enabled = true,
  disabled = false,
  frequency,
  controlLabel = "Frequency",
  valueLabel,
  onToggle,
  onFrequencyChange,
  children,
}: AutonomySliderRowProps) {
  const sliderDisabled = disabled || !enabled;

  return (
    <div
      className={`grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          {onToggle ? (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={disabled}
              onClick={() => onToggle(!enabled)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-default ${
                enabled ? "bg-white" : "bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-neutral-950 transition ${
                  enabled ? "left-[1.125rem]" : "left-0.5"
                }`}
              />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-100">
              {label}
            </p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {description}
            </p>
          </div>
        </div>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          <span>{controlLabel}</span>
          <span>{valueLabel ?? percent(frequency)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={frequency}
          disabled={sliderDisabled}
          onChange={(event) => onFrequencyChange(Number(event.target.value))}
          className="w-full disabled:opacity-40"
        />
      </label>
    </div>
  );
}

interface CharacterAutonomyPanelProps {
  availableRandomSitActions: RandomSitAction[] | null;
  behavior: BehaviorSettings;
  hasFloorCrawl: boolean;
  onFrequencyChange: (key: FrequencyKey, frequency: number) => void;
  onRandomBehaviorChange: (key: RandomBehaviorKey, checked: boolean) => void;
  onDialogueFrequencyChange: (frequency: number) => void;
  onResetBehavior: () => void;
  onToggleRandomSitAction: (action: RandomSitAction, checked: boolean) => void;
}

export function CharacterAutonomyPanel({
  availableRandomSitActions,
  behavior,
  hasFloorCrawl,
  onFrequencyChange,
  onRandomBehaviorChange,
  onDialogueFrequencyChange,
  onResetBehavior,
  onToggleRandomSitAction,
}: CharacterAutonomyPanelProps) {
  const visibleSitOptions = RANDOM_SIT_OPTIONS.filter(
    (option) =>
      availableRandomSitActions === null ||
      availableRandomSitActions.includes(option.action),
  );
  const showSitVariantPicker = visibleSitOptions.length > 1;
  const hasRandomSitVariants =
    availableRandomSitActions === null || availableRandomSitActions.length > 0;

  // floor mix is relative; disabled or missing actions should not steal weight.
  const floorWeights = {
    walk: behavior.allowRandomWalk ? behavior.walkFrequency : 0,
    crawl:
      behavior.allowRandomFloorCrawl && hasFloorCrawl
        ? behavior.floorCrawlFrequency
        : 0,
    sit:
      behavior.allowRandomSit && hasRandomSitVariants
        ? behavior.sitFrequency
        : 0,
  };
  const floorWeightTotal =
    floorWeights.walk + floorWeights.crawl + floorWeights.sit;
  const floorShare = (weight: number) =>
    floorWeightTotal > 0 ? percent(weight / floorWeightTotal) : "0%";

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-white">Autonomy</p>
          <p className="mt-1 text-xs text-neutral-500">
            Pace decides when it acts. Mix decides what it picks when a floor
            action starts.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetBehavior}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:border-white hover:text-white"
        >
          Reset behavior
        </button>
      </div>

      <div className="divide-y divide-neutral-800">
        <div className="bg-neutral-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Timing
        </div>

        <AutonomySliderRow
          label="Overall pace"
          description="How long it waits between idle decisions"
          frequency={behavior.actionFrequency}
          controlLabel="Idle rate"
          valueLabel={rateLabel(behavior.actionFrequency)}
          onFrequencyChange={(frequency) =>
            onFrequencyChange("actionFrequency", frequency)
          }
        />

        <div className="bg-neutral-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Floor action mix (relative, not activity rate)
        </div>

        <AutonomySliderRow
          label="Walk"
          description={`${floorShare(floorWeights.walk)} of floor actions`}
          enabled={behavior.allowRandomWalk}
          frequency={behavior.walkFrequency}
          controlLabel="Mix"
          valueLabel={weightLabel(behavior.walkFrequency)}
          onToggle={(checked) =>
            onRandomBehaviorChange("allowRandomWalk", checked)
          }
          onFrequencyChange={(frequency) =>
            onFrequencyChange("walkFrequency", frequency)
          }
        />

        <AutonomySliderRow
          label="Floor crawl"
          description={
            hasFloorCrawl
              ? `${floorShare(floorWeights.crawl)} of floor actions`
              : "No floor crawl animation assigned"
          }
          enabled={behavior.allowRandomFloorCrawl && hasFloorCrawl}
          disabled={!hasFloorCrawl}
          frequency={behavior.floorCrawlFrequency}
          controlLabel="Mix"
          valueLabel={weightLabel(behavior.floorCrawlFrequency)}
          onToggle={(checked) =>
            onRandomBehaviorChange("allowRandomFloorCrawl", checked)
          }
          onFrequencyChange={(frequency) =>
            onFrequencyChange("floorCrawlFrequency", frequency)
          }
        />

        <AutonomySliderRow
          label="Sit"
          description={
            hasRandomSitVariants
              ? `${floorShare(floorWeights.sit)} of floor actions`
              : "No floor sit animation assigned"
          }
          enabled={behavior.allowRandomSit && hasRandomSitVariants}
          disabled={!hasRandomSitVariants}
          frequency={behavior.sitFrequency}
          controlLabel="Mix"
          valueLabel={weightLabel(behavior.sitFrequency)}
          onToggle={(checked) => onRandomBehaviorChange("allowRandomSit", checked)}
          onFrequencyChange={(frequency) =>
            onFrequencyChange("sitFrequency", frequency)
          }
        >
          {showSitVariantPicker ? (
            <div className={`transition ${behavior.allowRandomSit ? "" : "opacity-45"}`}>
              <div className="flex flex-wrap gap-2">
                {visibleSitOptions.map((option) => {
                  const selected = behavior.randomSitActions.includes(
                    option.action,
                  );

                  return (
                    <button
                      key={option.action}
                      type="button"
                      aria-pressed={selected}
                      disabled={!behavior.allowRandomSit}
                      title={option.description}
                      onClick={() =>
                        onToggleRandomSitAction(option.action, !selected)
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:cursor-default ${
                        selected
                          ? "border-white bg-white text-black"
                          : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {behavior.allowRandomSit && behavior.randomSitActions.length === 0 ? (
                <p className="mt-2 text-xs text-amber-300">
                  Pick at least one sitting style or random sitting stays off.
                </p>
              ) : null}
            </div>
          ) : null}
        </AutonomySliderRow>

        <div className="bg-neutral-900/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Attached actions
        </div>

        <AutonomySliderRow
          label="Wall climb"
          description="Move on vertical edges when attached"
          enabled={behavior.allowRandomWallClimb}
          frequency={behavior.wallClimbFrequency}
          controlLabel="Climb rate"
          valueLabel={rateLabel(behavior.wallClimbFrequency)}
          onToggle={(checked) =>
            onRandomBehaviorChange("allowRandomWallClimb", checked)
          }
          onFrequencyChange={(frequency) =>
            onFrequencyChange("wallClimbFrequency", frequency)
          }
        />

        <AutonomySliderRow
          label="Ceiling crawl"
          description="Move under windows when attached"
          enabled={behavior.allowRandomCeilingCrawl}
          frequency={behavior.ceilingCrawlFrequency}
          controlLabel="Crawl rate"
          valueLabel={rateLabel(behavior.ceilingCrawlFrequency)}
          onToggle={(checked) =>
            onRandomBehaviorChange("allowRandomCeilingCrawl", checked)
          }
          onFrequencyChange={(frequency) =>
            onFrequencyChange("ceilingCrawlFrequency", frequency)
          }
        />

        <AutonomySliderRow
          label="Talk"
          description="Chance each dialogue timer fires"
          enabled={behavior.allowRandomDialogue}
          frequency={behavior.dialogueFrequency}
          controlLabel="Chance"
          valueLabel={`${percent(behavior.dialogueFrequency)} per check`}
          onToggle={(checked) =>
            onRandomBehaviorChange("allowRandomDialogue", checked)
          }
          onFrequencyChange={onDialogueFrequencyChange}
        />
      </div>
    </div>
  );
}
