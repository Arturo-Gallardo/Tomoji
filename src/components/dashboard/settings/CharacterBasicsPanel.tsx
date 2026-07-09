import type { Dispatch, SetStateAction } from "react";
import { openCharacterFolder } from "../../../services/tomojiStorage";
import type {
  BehaviorSettings,
  CharacterSource,
  SurfaceAttachmentOffsets,
} from "../../../types/character";

const SCALE_PRESETS = [
  { label: "Tiny", value: 0.25 },
  { label: "Small", value: 0.5 },
  { label: "Normal", value: 1 },
  { label: "Big", value: 2 },
] as const;

const SPEED_PRESETS = [
  { label: "Calm", value: 0.75 },
  { label: "Normal", value: 1 },
  { label: "Fast", value: 1.5 },
] as const;

interface CharacterBasicsPanelProps {
  behavior: BehaviorSettings;
  canEditAnimations: boolean;
  characterId: string;
  characterSource: CharacterSource | null;
  editAnimationDescription: string;
  editAnimationLabel: string;
  isBuiltin: boolean;
  name: string;
  scale: number;
  showHelperTips: boolean;
  surfaceOffsets: SurfaceAttachmentOffsets;
  onEditFrames?: () => void;
  onNameChange: (name: string) => void;
  onScaleChange: (scale: number) => void;
  onBehaviorChange: Dispatch<SetStateAction<BehaviorSettings>>;
  onSurfaceOffsetsChange: Dispatch<SetStateAction<SurfaceAttachmentOffsets>>;
}

export function CharacterBasicsPanel({
  behavior,
  canEditAnimations,
  characterId,
  characterSource,
  editAnimationDescription,
  editAnimationLabel,
  isBuiltin,
  name,
  scale,
  showHelperTips,
  surfaceOffsets,
  onEditFrames,
  onNameChange,
  onScaleChange,
  onBehaviorChange,
  onSurfaceOffsetsChange,
}: CharacterBasicsPanelProps) {
  return (
    <div className="space-y-6">
      {showHelperTips ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
          <p className="text-sm font-bold text-sky-100">Quick edit guide</p>
          <p className="mt-1 text-xs leading-relaxed text-sky-100/70">
            Start with size and movement speed, then tune autonomy. Save to apply
            changes to running companions.
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
          onChange={(event) => onNameChange(event.target.value)}
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
          min={0.1}
          max={8}
          step={0.05}
          value={scale}
          onChange={(event) => onScaleChange(Number(event.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SCALE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onScaleChange(preset.value)}
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

      {!isBuiltin ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            Window attach offset
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Per-Tomoji tweak for wall grabs and underside crawls. Positive values
            push the sprite farther outside the window edge.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-bold text-neutral-400">
              Walls: {surfaceOffsets.wall}px
            </span>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={surfaceOffsets.wall}
              onChange={(event) =>
                onSurfaceOffsetsChange((current) => ({
                  ...current,
                  wall: Number(event.target.value),
                }))
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-bold text-neutral-400">
              Ceilings: {surfaceOffsets.ceiling}px
            </span>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={surfaceOffsets.ceiling}
              onChange={(event) =>
                onSurfaceOffsetsChange((current) => ({
                  ...current,
                  ceiling: Number(event.target.value),
                }))
              }
              className="mt-2 w-full"
            />
          </label>
        </div>
      ) : null}

      {canEditAnimations ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
            {characterSource === "shimeji"
              ? "Shimeji action mapping"
              : "Animation frames"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            {editAnimationDescription}
          </p>
          <button
            type="button"
            onClick={onEditFrames}
            className="mt-4 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-bold text-white hover:border-white"
          >
            {editAnimationLabel}
          </button>
          {characterSource === "tomoji" ? (
            <button
              type="button"
              onClick={() => void openCharacterFolder(characterId)}
              className="ml-3 mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-300 hover:border-white hover:text-white"
            >
              Open folder
            </button>
          ) : null}
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
            onBehaviorChange((current) => ({
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
                onBehaviorChange((current) => ({
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
    </div>
  );
}
