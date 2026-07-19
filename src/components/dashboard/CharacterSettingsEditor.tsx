import { useEffect, useState } from "react";
import { TITLE_BAR_SIT_Y_OFFSET } from "../../animations/companionGeometry";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  DEFAULT_BEHAVIOR_SETTINGS,
  normalizeBehaviorSettings,
  RANDOM_SIT_ACTIONS,
} from "../../services/behaviorSettings";
import {
  getCharacter,
  isBuiltinCharacterId,
  updateCharacterSurfaceAttachmentOffsets,
} from "../../services/characterLibrary";
import type {
  BehaviorSettings,
  CharacterSource,
  RandomSitAction,
  SurfaceAttachmentOffsets,
} from "../../types/character";
import type { CompanionInstance } from "../../types/companionInstance";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";
import { CharacterAutonomyPanel } from "./settings/CharacterAutonomyPanel";
import type {
  FrequencyKey,
  RandomBehaviorKey,
} from "./settings/CharacterAutonomyPanel";
import { CharacterBasicsPanel } from "./settings/CharacterBasicsPanel";
import { DialogueLinesEditor } from "./settings/DialogueLinesEditor";
import { IslandIcon } from "../ui/IslandIcon";

const DEFAULT_SURFACE_ATTACHMENT_OFFSETS: SurfaceAttachmentOffsets = {
  wall: 0,
  ceiling: 0,
  titleBar: TITLE_BAR_SIT_Y_OFFSET,
};

function instanceBehavior(instance: CompanionInstance): BehaviorSettings {
  return normalizeBehaviorSettings({
    ...instance.behaviorSettings,
    dialogueFrequency: instance.dialogueSettings.frequency,
  });
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
  const [savedName, setSavedName] = useState(instance.name);
  const [scale, setScale] = useState(instance.scale);
  const [savedScale, setSavedScale] = useState(instance.scale);
  const [behavior, setBehavior] = useState(() => instanceBehavior(instance));
  const [savedBehavior, setSavedBehavior] = useState(() =>
    instanceBehavior(instance),
  );
  const [dialogue, setDialogue] = useState(instance.dialogueSettings);
  const [savedDialogue, setSavedDialogue] = useState(instance.dialogueSettings);
  const [surfaceOffsets, setSurfaceOffsets] = useState(
    DEFAULT_SURFACE_ATTACHMENT_OFFSETS,
  );
  const [savedSurfaceOffsets, setSavedSurfaceOffsets] = useState(
    DEFAULT_SURFACE_ATTACHMENT_OFFSETS,
  );
  const [availableRandomSitActions, setAvailableRandomSitActions] =
    useState<RandomSitAction[] | null>(null);
  const [characterSource, setCharacterSource] = useState<CharacterSource | null>(
    null,
  );
  const [hasFloorCrawl, setHasFloorCrawl] = useState(false);
  const [lineDraft, setLineDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canEditAnimations =
    onEditFrames !== undefined &&
    characterSource !== null &&
    characterSource !== "builtin" &&
    !isBuiltin;
  const editAnimationLabel =
    characterSource === "shimeji"
      ? "Remap Shimeji actions"
      : "Edit Tomoji frames";
  const editAnimationDescription =
    characterSource === "shimeji"
      ? "Choose which preserved Shimeji action powers each Tomoji behavior. Imported sprites, frame order, and timing stay locked."
      : "Change which sprites play for idle, walk, sit, and other actions.";
  const hasUnsavedChanges =
    name !== savedName ||
    scale !== savedScale ||
    JSON.stringify(behavior) !== JSON.stringify(savedBehavior) ||
    JSON.stringify(dialogue) !== JSON.stringify(savedDialogue) ||
    JSON.stringify(surfaceOffsets) !== JSON.stringify(savedSurfaceOffsets);

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
    const nextBehavior = instanceBehavior(instance);
    setName(instance.name);
    setSavedName(instance.name);
    setScale(instance.scale);
    setSavedScale(instance.scale);
    setBehavior(nextBehavior);
    setSavedBehavior(nextBehavior);
    setDialogue(instance.dialogueSettings);
    setSavedDialogue(instance.dialogueSettings);
  }, [instance.id]);

  useEffect(() => {
    let cancelled = false;

    void getCharacter(instance.characterId).then((entry) => {
      if (cancelled) {
        return;
      }

      setCharacterSource(entry?.source ?? null);
      const manifest = entry?.manifest;
      const nextSurfaceOffsets =
        {
          ...DEFAULT_SURFACE_ATTACHMENT_OFFSETS,
          ...manifest?.surfaceAttachmentOffsets,
        };
      setSurfaceOffsets(nextSurfaceOffsets);
      setSavedSurfaceOffsets(nextSurfaceOffsets);

      // shimeji graph imports expose sit actions by name instead of legacy slots.
      const available = RANDOM_SIT_ACTIONS.filter((action) => {
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
      });
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
      if (!isBuiltin) {
        await updateCharacterSurfaceAttachmentOffsets(
          instance.characterId,
          surfaceOffsets,
        );
      }
      await onSave(instance.id, {
        name,
        scale,
        behaviorSettings: behavior,
        dialogueSettings: {
          ...dialogue,
          frequency: behavior.dialogueFrequency,
        },
      });
      setSavedName(name);
      setSavedScale(scale);
      setSavedBehavior(behavior);
      setSavedDialogue({
        ...dialogue,
        frequency: behavior.dialogueFrequency,
      });
      setSavedSurfaceOffsets(surfaceOffsets);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TomojiPageLayout
      header={
        <TomojiPageHeader
          title={`Edit ${instance.name}`}
          subtitle="Shape their look, personality, and favorite things to say."
          onBack={handleClose}
          trailing={
            <span className={`island-badge ${isBuiltin ? "border-dashed" : "island-badge--active"}`}>
              {isBuiltin ? "Built-in Tomoji" : "Imported Tomoji"}
            </span>
          }
        />
      }
      footer={
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              aria-busy={isSaving}
              className="island-button island-button--action"
            >
              <IslandIcon name="check" className="h-4 w-4" />
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            {isSaving || hasUnsavedChanges ? (
              <span
                className={`island-badge ${
                  hasUnsavedChanges ? "island-badge--warning" : ""
                }`}
                aria-live="polite"
              >
                {isSaving ? "Saving changes" : "Unsaved changes"}
              </span>
            ) : null}
          </div>
          <p className="text-xs font-medium leading-relaxed text-island-muted">
            Changes reach running Tomojis as soon as you save.
          </p>
        </div>
      }
    >
      <div className="island-page-enter grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)] lg:items-start">
        <div className="space-y-5">
          <CharacterBasicsPanel
            behavior={behavior}
            canEditAnimations={canEditAnimations}
            characterId={instance.characterId}
            characterSource={characterSource}
            editAnimationDescription={editAnimationDescription}
            editAnimationLabel={editAnimationLabel}
            isBuiltin={isBuiltin}
            name={name}
            scale={scale}
            showHelperTips={settings?.showHelperTips !== false}
            surfaceOffsets={surfaceOffsets}
            onEditFrames={onEditFrames}
            onNameChange={setName}
            onScaleChange={setScale}
            onBehaviorChange={setBehavior}
            onSurfaceOffsetsChange={setSurfaceOffsets}
          />

          <CharacterAutonomyPanel
            availableRandomSitActions={availableRandomSitActions}
            behavior={behavior}
            hasFloorCrawl={hasFloorCrawl}
            onDialogueFrequencyChange={setDialogueFrequency}
            onFrequencyChange={setFrequency}
            onRandomBehaviorChange={setRandomBehavior}
            onResetBehavior={resetBehavior}
            onToggleRandomSitAction={toggleRandomSitAction}
          />
        </div>

        <div className="min-w-0">
          <DialogueLinesEditor
            lineDraft={lineDraft}
            lines={dialogue.lines}
            onAddLine={addLine}
            onLineDraftChange={setLineDraft}
            onRemoveLine={removeLine}
          />
        </div>
      </div>
    </TomojiPageLayout>
  );
}
