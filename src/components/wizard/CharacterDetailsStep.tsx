import { useState } from "react";
import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";

interface CharacterDetailsStepProps {
  controller: ShimejiDraftController;
}

export function CharacterDetailsStep({ controller }: CharacterDetailsStepProps) {
  const {
    draft,
    setName,
    addDialogueLine,
    removeDialogueLine,
    setDialogueFrequency,
    patchBehavior,
    setScale,
    setSpeed,
  } = controller;
  const [lineDraft, setLineDraft] = useState("");

  const submitLine = () => {
    addDialogueLine(lineDraft);
    setLineDraft("");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-5">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Name
          </span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My Tomoji"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Movement speed: {draft.speed.toFixed(1)} px/tick
          </span>
            <input
              type="range"
              min={0.5}
            max={12}
              step={0.5}
              value={draft.speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Scale: {draft.scale.toFixed(2)}x
          </span>
            <input
              type="range"
              min={0.5}
            max={4}
              step={0.05}
              value={draft.scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Action frequency: {Math.round(draft.behavior.actionFrequency * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.behavior.actionFrequency}
            onChange={(event) =>
              patchBehavior({ actionFrequency: Number(event.target.value) })
            }
            className="mt-1 w-full"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Dialogue lines
          </span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={lineDraft}
              onChange={(event) => setLineDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitLine();
                }
              }}
              placeholder="Add a line..."
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-white"
            />
            <button
              type="button"
              onClick={submitLine}
              className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-black"
            >
              Add
            </button>
          </div>

          {draft.dialogueLines.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {draft.dialogueLines.map((line, index) => (
                <li
                  key={`${line}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-200"
                >
                  <span className="truncate">{line}</span>
                  <button
                    type="button"
                    onClick={() => removeDialogueLine(index)}
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
            Dialogue frequency: {Math.round(draft.dialogueFrequency * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.dialogueFrequency}
            onChange={(event) =>
              setDialogueFrequency(Number(event.target.value))
            }
            className="mt-1 w-full"
          />
        </label>
      </div>
    </div>
  );
}
