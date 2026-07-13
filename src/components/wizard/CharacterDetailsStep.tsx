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
          <span className="text-xs font-bold uppercase text-island-ink">
            Name
          </span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My Tomoji"
            className="island-input mt-1 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase text-island-ink">
            Movement speed: {draft.speed.toFixed(1)} px/tick
          </span>
            <input
              type="range"
              min={0.5}
            max={12}
              step={0.5}
              value={draft.speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="island-slider mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase text-island-ink">
            Scale: {draft.scale.toFixed(2)}x
          </span>
            <input
              type="range"
              min={0.5}
            max={4}
              step={0.05}
              value={draft.scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="island-slider mt-1 w-full"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase text-island-ink">
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
            className="island-slider mt-1 w-full"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs font-bold uppercase text-island-ink">
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
              className="island-input flex-1 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={submitLine}
              className="island-button island-button--primary min-h-10 px-3 py-2 text-sm"
            >
              Add
            </button>
          </div>

          {draft.dialogueLines.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {draft.dialogueLines.map((line, index) => (
                <li
                  key={`${line}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-island-ink/30 bg-island-paper/80 px-3 py-2 text-sm font-medium text-island-ink"
                >
                  <span className="truncate">{line}</span>
                  <button
                    type="button"
                    onClick={() => removeDialogueLine(index)}
                    className="px-2 text-red-700 hover:text-red-800"
                    aria-label="Remove line"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-island-ink/30 px-3 py-4 text-center text-xs font-medium text-island-muted">
              No dialogue lines yet.
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase text-island-ink">
            Dialogue frequency: {Math.round(draft.dialogueFrequency * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.dialogueFrequency}
            onChange={(event) => {
              const frequency = Number(event.target.value);
              setDialogueFrequency(frequency);
              patchBehavior({ dialogueFrequency: frequency });
            }}
            className="island-slider mt-1 w-full"
          />
        </label>
      </div>
    </div>
  );
}
