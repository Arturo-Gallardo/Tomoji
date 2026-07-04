import { useState } from "react";
import { isBuiltinCharacterId } from "../../services/characterLibrary";
import { TomojiPageHeader } from "./TomojiPageHeader";
import { TomojiPageLayout } from "./TomojiPageLayout";
import type { CompanionInstance } from "../../types/companionInstance";

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
  const isBuiltin = isBuiltinCharacterId(instance.characterId);
  const [name, setName] = useState(instance.characterId);
  const [scale, setScale] = useState(instance.scale);
  const [behavior, setBehavior] = useState(instance.behaviorSettings);
  const [dialogue, setDialogue] = useState(instance.dialogueSettings);
  const [lineDraft, setLineDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canEditFrames = onEditFrames !== undefined;

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(instance.id, {
        name,
        scale,
        behaviorSettings: behavior,
        dialogueSettings: dialogue,
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
          onBack={onClose}
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
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Folder name
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
                ? "Built-in folder name stays fixed so bundled updates keep working."
                : "Matches the Tomoji folder on disk. Saving renames the folder (for example, Gojo becomes gojo)."}
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
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Action frequency: {Math.round(behavior.actionFrequency * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={behavior.actionFrequency}
              onChange={(event) =>
                setBehavior((current) => ({
                  ...current,
                  actionFrequency: Number(event.target.value),
                }))
              }
              className="mt-2 w-full"
            />
          </label>
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

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Dialogue frequency: {Math.round(dialogue.frequency * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={dialogue.frequency}
              onChange={(event) =>
                setDialogue((current) => ({
                  ...current,
                  frequency: Number(event.target.value),
                }))
              }
              className="mt-2 w-full"
            />
          </label>
        </div>
      </div>
    </TomojiPageLayout>
  );
}
