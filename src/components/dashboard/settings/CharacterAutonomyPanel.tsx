import { useId, type ReactNode } from "react";
import type { BehaviorSettings, RandomSitAction } from "../../../types/character";
import { IslandIcon } from "../../ui/IslandIcon";

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
  const labelId = useId();
  const descriptionId = useId();
  const sliderDisabled = disabled || !enabled;

  return (
    <div
      className={`island-form-section grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-center ${
        disabled ? "border-dashed" : ""
      }`}
      aria-disabled={disabled || undefined}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p id={labelId} className="text-sm font-extrabold text-island-ink">
              {label}
            </p>
            <p
              id={descriptionId}
              className="mt-1 text-xs font-medium leading-relaxed text-island-muted"
            >
              {description}
            </p>
          </div>

          {onToggle ? (
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`island-badge ${enabled ? "island-badge--active" : ""} ${
                  disabled ? "border-dashed" : ""
                }`}
              >
                {disabled ? "Unavailable" : enabled ? "On" : "Off"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                disabled={disabled}
                onClick={() => onToggle(!enabled)}
                className="island-toggle disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-60"
              >
                <span className="island-toggle-knob" />
              </button>
            </div>
          ) : null}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>

      <div className="block min-w-0">
        <span className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-island-muted">
            {controlLabel}
          </span>
          <output
            className={`island-badge ${sliderDisabled ? "border-dashed" : ""}`}
          >
            {valueLabel ?? percent(frequency)}
          </output>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={frequency}
          disabled={sliderDisabled}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          aria-valuetext={valueLabel ?? percent(frequency)}
          onChange={(event) => onFrequencyChange(Number(event.target.value))}
          className="island-slider w-full disabled:cursor-not-allowed disabled:opacity-45"
        />
      </div>
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
    <section className="island-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b-2 border-island-ink/10 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-mint/60">
            <IslandIcon name="sparkles" className="h-5 w-5" />
          </span>
          <div>
            <span className="island-badge mb-2 bg-island-mint/50">
              Free time
            </span>
            <h2 className="text-lg font-extrabold text-island-ink">Autonomy</h2>
            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-island-muted">
              Pace decides when it acts. Mix decides what it picks when a floor
              action starts.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetBehavior}
          className="island-button island-button--soft shrink-0 self-start text-xs"
        >
          <IslandIcon name="restore" className="h-4 w-4" />
          Reset behavior
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="island-surface px-4 py-3">
          <h3 className="text-sm font-extrabold text-island-ink">Timing</h3>
          <p className="mt-1 text-xs font-medium text-island-muted">
            Decide how often this Tomoji looks for something to do.
          </p>
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

        <div className="island-surface px-4 py-3">
          <h3 className="text-sm font-extrabold text-island-ink">
            Floor action mix
          </h3>
          <p className="mt-1 text-xs font-medium text-island-muted">
            Relative preference when a floor action starts, not overall activity.
          </p>
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
            <div className={behavior.allowRandomSit ? "" : "opacity-60"}>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Sitting styles"
              >
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
                      className={`island-button min-h-9 px-3 py-1.5 text-xs ${
                        selected
                          ? "island-button--primary"
                          : "island-button--soft"
                      }`}
                    >
                      {selected ? (
                        <IslandIcon name="check" className="h-3.5 w-3.5" />
                      ) : null}
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {behavior.allowRandomSit &&
              behavior.randomSitActions.length === 0 ? (
                <p
                  className="island-notice island-notice--warning mt-3 px-3 py-2 text-xs font-semibold"
                  role="alert"
                >
                  Pick at least one sitting style or random sitting stays off.
                </p>
              ) : null}
            </div>
          ) : null}
        </AutonomySliderRow>

        <div className="island-surface px-4 py-3">
          <h3 className="text-sm font-extrabold text-island-ink">
            Attached actions
          </h3>
          <p className="mt-1 text-xs font-medium text-island-muted">
            Choose what it can do while holding a wall or ceiling.
          </p>
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
    </section>
  );
}
