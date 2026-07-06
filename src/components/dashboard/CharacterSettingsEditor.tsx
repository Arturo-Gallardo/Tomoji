import { useEffect, useState, type ReactNode } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
  RANDOM_SIT_ACTIONS,
} from "../../services/behaviorSettings";
import {
  getCharacter,
  isBuiltinCharacterId,
} from "../../services/characterLibrary";
import { openCharacterFolder } from "../../services/tomojiStorage";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";
import type { BehaviorSettings, RandomSitAction } from "../../types/character";
import type { CompanionInstance } from "../../types/companionInstance";

type RandomBehaviorKey = Extract<
  keyof BehaviorSettings,
  | "allowRandomWalk"
  | "allowRandomFloorCrawl"
  | "allowRandomSit"
  | "allowRandomWallClimb"
  | "allowRandomCeilingCrawl"
  | "allowRandomDialogue"
>;

type FrequencyKey = Extract<
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

const SCALE_PRESETS = [
  { label: "Tiny", value: 0.75 },
  { label: "Normal", value: 1 },
  { label: "Big", value: 1.5 },
] as const;

const SPEED_PRESETS = [
  { label: "Calm", value: 0.75 },
  { label: "Normal", value: 1 },
  { label: "Fast", value: 1.5 },
] as const;

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

function sameSitActions(
  first: readonly RandomSitAction[],
  second: readonly RandomSitAction[],
): boolean {
  return (
    first.length === second.length &&
    first.every((action, index) => action === second[index])
  );
}

interface CharacterSettingsEditorProps {
  instance: CompanionInstance;
  onClose: () => void;
  onEditFrames?: () => void;
  onSave: (
    id: string,
    patch: Partial<Omit<CompanionInstance, "id">>,
  ) => Promise<void>;
}

export function CharacterSettingsEditor({
  instance,
  onClose,
  onEditFrames,
  onSave,
}: CharacterSettingsEditorProps) {
  const { settings } = useAppSettings();
  const isBuiltin = isBuiltinCharacterId(instance.characterId);
  const [name, setName] = useState(instance.name);
  const [scale, setScale] = useState(instance.scale);
  const [behavior, setBehavior] = useState(() =>
    normalizeBehaviorSettings({
      ...instance.behaviorSettings,
      dialogueFrequency: instance.dialogueSettings.frequency,
    }),
  );
  const [dialogue, setDialogue] = useState(instance.dialogueSettings);
  const [availableRandomSitActions, setAvailableRandomSitActions] =
    useState<RandomSitAction[] | null>(null);
  const [hasFloorCrawl, setHasFloorCrawl] = useState(false);
  const [lineDraft, setLineDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canEditFrames = onEditFrames !== undefined;
  const visibleSitOptions = RANDOM_SIT_OPTIONS.filter(
    (option) =>
      availableRandomSitActions === null ||
      availableRandomSitActions.includes(option.action),
  );
  const showSitVariantPicker = visibleSitOptions.length > 1;
  const hasRandomSitVariants =
    availableRandomSitActions === null || availableRandomSitActions.length > 0;
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
  const hasUnsavedChanges =
    name !== instance.name ||
    scale !== instance.scale ||
    JSON.stringify(behavior) !==
      JSON.stringify(
        normalizeBehaviorSettings({
          ...instance.behaviorSettings,
          dialogueFrequency: instance.dialogueSettings.frequency,
        }),
      ) ||
    JSON.stringify(dialogue) !== JSON.stringify(instance.dialogueSettings);

  const handleClose = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved changes to this Tomoji?")
    ) {
      return;
    }

    onClose();
  };

  const addLine = () => {
    const trimmed = lineDraft.trim();
    if (trimmed === "") {
      return;
    }
    setDialogue((current) => ({
      ...current,
      lines: [...current.lines, trimmed],
    }));
    setLineDraft("");
  };

  const removeLine = (index: number) => {
    setDialogue((current) => ({
      ...current,
      lines: current.lines.filter((_, i) => i !== index),
    }));
  };

  const setRandomBehavior = (key: RandomBehaviorKey, checked: boolean) => {
    setBehavior((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const setFrequency = (key: FrequencyKey, frequency: number) => {
    setBehavior((current) => ({
      ...current,
      [key]: frequency,
    }));
  };

  const setDialogueFrequency = (frequency: number) => {
    setFrequency("dialogueFrequency", frequency);
    setDialogue((current) => ({
      ...current,
      frequency,
    }));
  };

  const resetBehavior = () => {
    const defaultBehavior = normalizeBehaviorSettings(DEFAULT_BEHAVIOR_SETTINGS);
    setBehavior(defaultBehavior);
    setDialogue((current) => ({
      ...current,
      frequency: defaultBehavior.dialogueFrequency,
    }));
  };

  const toggleRandomSitAction = (
    action: RandomSitAction,
    checked: boolean,
  ) => {
    setBehavior((current) => {
      const nextActions = checked
        ? [...current.randomSitActions, action]
        : current.randomSitActions.filter(
            (currentAction) => currentAction !== action,
          );

      return {
        ...current,
        randomSitActions: RANDOM_SIT_ACTIONS.filter((currentAction) =>
          nextActions.includes(currentAction),
        ),
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    void getCharacter(instance.characterId).then((entry) => {
      if (cancelled) {
        return;
      }

      const manifest = entry?.manifest;
      const available = RANDOM_SIT_ACTIONS.filter(
        (action) => {
          if (!manifest) {
            return false;
          }

          if (manifest.animationSystem === "shimejiGraph") {
            const actionName = manifest.shimejiGraph?.defaultActions[action];
            return actionName
              ? manifest.shimejiGraph?.actions[actionName] !== undefined
              : false;
          }

          return (manifest.animations[action]?.frames.length ?? 0) > 0;
        },
      );
      setAvailableRandomSitActions(available);
      if (manifest?.animationSystem === "shimejiGraph") {
        const floorCrawlActionName =
          manifest.shimejiGraph?.defaultActions.floorCrawl;
        setHasFloorCrawl(
          floorCrawlActionName
            ? manifest.shimejiGraph?.actions[floorCrawlActionName] !== undefined
            : false,
        );
        return;
      }

      setHasFloorCrawl((manifest?.animations.floorCrawl?.frames.length ?? 0) > 0);
    });

    return () => {
      cancelled = true;
    };
  }, [instance.characterId]);

  useEffect(() => {
    if (availableRandomSitActions === null) {
      return;
    }

    setBehavior((current) => {
      const normalized =
        availableRandomSitActions.length <= 1
          ? availableRandomSitActions
          : RANDOM_SIT_ACTIONS.filter(
              (action) =>
                availableRandomSitActions.includes(action) &&
                current.randomSitActions.includes(action),
            );

      if (sameSitActions(current.randomSitActions, normalized)) {
        return current;
      }

      return {
        ...current,
        randomSitActions: normalized,
      };
    });
  }, [availableRandomSitActions]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(instance.id, {
        name,
        scale,
        behaviorSettings: behavior,
        dialogueSettings: {
          ...dialogue,
          frequency: behavior.dialogueFrequency,
        },
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title={`Edit ${instance.name}`}
          onBack={handleClose}
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          <p className="text-xs text-neutral-500">
            Changes apply to running Tomojis as soon as you save.
          </p>
        </div>
      }
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          {settings?.showHelperTips !== false ? (
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
              <p className="text-sm font-bold text-sky-100">Quick edit guide</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-100/70">
                Start with size and movement speed, then tune autonomy. Save to
                apply changes to running companions.
              </p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Tomoji name
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isBuiltin}
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white"
            />
            <p className="mt-2 text-xs text-neutral-500">
              {isBuiltin
                ? "Built-in display name only. Bundled files stay fixed."
                : "For imported Tomojis, saving a new name also renames the folder on disk."}
            </p>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Scale: {scale.toFixed(2)}x
            </span>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.05}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {SCALE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setScale(preset.value)}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-bold text-neutral-300 hover:border-white hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Size changes the on-screen Tomoji window, not the source sprites.
            </p>
          </label>

          {canEditFrames ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                Animation frames
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Change which sprites play for idle, walk, sit, and other
                actions.
              </p>
              <button
                type="button"
                onClick={onEditFrames}
                className="mt-4 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-bold text-white hover:border-white"
              >
                Edit frames
              </button>
              <button
                type="button"
                onClick={() => void openCharacterFolder(instance.characterId)}
                className="ml-3 mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-300 hover:border-white hover:text-white"
              >
                Open folder
              </button>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Movement speed: {behavior.movementSpeed.toFixed(2)}x
            </span>
            <input
              type="range"
              min={0.1}
              max={8}
              step={0.1}
              value={behavior.movementSpeed}
              onChange={(event) =>
                setBehavior((current) => ({
                  ...current,
                  movementSpeed: Number(event.target.value),
                }))
              }
              className="mt-2 w-full"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setBehavior((current) => ({
                      ...current,
                      movementSpeed: preset.value,
                    }))
                  }
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-bold text-neutral-300 hover:border-white hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </label>

          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-white">Autonomy</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Pace decides when it acts. Mix decides what it picks when a
                  floor action starts.
                </p>
              </div>
              <button
                type="button"
                onClick={resetBehavior}
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
                  setFrequency("actionFrequency", frequency)
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
                  setRandomBehavior("allowRandomWalk", checked)
                }
                onFrequencyChange={(frequency) =>
                  setFrequency("walkFrequency", frequency)
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
                  setRandomBehavior("allowRandomFloorCrawl", checked)
                }
                onFrequencyChange={(frequency) =>
                  setFrequency("floorCrawlFrequency", frequency)
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
                onToggle={(checked) =>
                  setRandomBehavior("allowRandomSit", checked)
                }
                onFrequencyChange={(frequency) =>
                  setFrequency("sitFrequency", frequency)
                }
              >
                {showSitVariantPicker ? (
                  <div
                    className={`transition ${
                      behavior.allowRandomSit ? "" : "opacity-45"
                    }`}
                  >
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
                              toggleRandomSitAction(option.action, !selected)
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

                    {behavior.allowRandomSit &&
                    behavior.randomSitActions.length === 0 ? (
                      <p className="mt-2 text-xs text-amber-300">
                        Pick at least one sitting style or random sitting stays
                        off.
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
                  setRandomBehavior("allowRandomWallClimb", checked)
                }
                onFrequencyChange={(frequency) =>
                  setFrequency("wallClimbFrequency", frequency)
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
                  setRandomBehavior("allowRandomCeilingCrawl", checked)
                }
                onFrequencyChange={(frequency) =>
                  setFrequency("ceilingCrawlFrequency", frequency)
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
                  setRandomBehavior("allowRandomDialogue", checked)
                }
                onFrequencyChange={setDialogueFrequency}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Dialogue lines
            </span>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={lineDraft}
                onChange={(event) => setLineDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addLine();
                  }
                }}
                placeholder="Add a line..."
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={addLine}
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black"
              >
                Add
              </button>
            </div>

            {dialogue.lines.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {dialogue.lines.map((line, index) => (
                  <li
                    key={`${line}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
                  >
                    <span className="truncate">{line}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="px-2 text-red-300 hover:text-red-200"
                      aria-label="Remove line"
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-500">
                No dialogue lines yet.
              </p>
            )}
          </div>

        </div>
      </div>
    </TomojiPageLayout>
  );
}
