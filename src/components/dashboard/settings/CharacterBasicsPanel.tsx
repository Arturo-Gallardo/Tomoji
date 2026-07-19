import { useId, type Dispatch, type SetStateAction } from "react";
import { openCharacterFolder } from "../../../services/tomojiStorage";
import type {
  BehaviorSettings,
  CharacterSource,
  SurfaceAttachmentOffsets,
} from "../../../types/character";
import { IslandIcon } from "../../ui/IslandIcon";

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
  const scaleInputId = useId();
  const speedInputId = useId();
  const wallOffsetInputId = useId();
  const ceilingOffsetInputId = useId();
  const titleBarOffsetInputId = useId();

  return (
    <div className="space-y-5">
      {showHelperTips ? (
        <aside className="island-notice flex items-start gap-3 px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-sky/50">
            <IslandIcon name="sparkles" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-island-ink">
              Quick edit guide
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">
              Start with size and movement speed, then tune autonomy. Save to apply
              changes to running companions.
            </p>
          </div>
        </aside>
      ) : null}

      <section className="island-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-custard">
            <IslandIcon name="tomoji" className="h-5 w-5" />
          </span>
          <div>
            <span className="island-badge mb-2">Look &amp; feel</span>
            <h2 className="text-lg font-extrabold text-island-ink">
              Companion basics
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-island-muted">
              Choose how this Tomoji appears and moves around your desktop.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="island-form-section block">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-island-ink">
                Tomoji name
              </span>
              {isBuiltin ? (
                <span className="island-badge border-dashed">Name locked</span>
              ) : null}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isBuiltin}
              className="island-input mt-3 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-island-cream disabled:opacity-75"
            />
            <span className="mt-2 block text-xs font-medium leading-relaxed text-island-muted">
              {isBuiltin
                ? "Built-in display name only. Bundled files stay fixed."
                : "For imported Tomojis, saving a new name also renames the folder on disk."}
            </span>
          </label>

          <div className="island-form-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={scaleInputId}
                className="text-sm font-extrabold text-island-ink"
              >
                Size
              </label>
              <output
                htmlFor={scaleInputId}
                className="island-badge island-badge--active"
              >
                {scale.toFixed(2)}x
              </output>
            </div>
            <input
              id={scaleInputId}
              type="range"
              min={0.1}
              max={8}
              step={0.05}
              value={scale}
              aria-valuetext={`${scale.toFixed(2)} times`}
              onChange={(event) => onScaleChange(Number(event.target.value))}
              className="island-slider mt-4 w-full"
            />
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Size presets"
            >
              {SCALE_PRESETS.map((preset) => {
                const selected = Math.abs(scale - preset.value) < 0.001;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onScaleChange(preset.value)}
                    className={`island-button min-h-9 px-3 py-1.5 text-xs ${
                      selected ? "island-button--primary" : "island-button--soft"
                    }`}
                  >
                    {selected ? (
                      <IslandIcon name="check" className="h-3.5 w-3.5" />
                    ) : null}
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-medium leading-relaxed text-island-muted">
              Size changes the on-screen Tomoji window, not the source sprites.
            </p>
          </div>

          <div className="island-form-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={speedInputId}
                className="text-sm font-extrabold text-island-ink"
              >
                Movement speed
              </label>
              <output
                htmlFor={speedInputId}
                className="island-badge island-badge--active"
              >
                {behavior.movementSpeed.toFixed(2)}x
              </output>
            </div>
            <input
              id={speedInputId}
              type="range"
              min={0.1}
              max={8}
              step={0.1}
              value={behavior.movementSpeed}
              aria-valuetext={`${behavior.movementSpeed.toFixed(2)} times`}
              onChange={(event) =>
                onBehaviorChange((current) => ({
                  ...current,
                  movementSpeed: Number(event.target.value),
                }))
              }
              className="island-slider mt-4 w-full"
            />
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Movement speed presets"
            >
              {SPEED_PRESETS.map((preset) => {
                const selected =
                  Math.abs(behavior.movementSpeed - preset.value) < 0.001;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      onBehaviorChange((current) => ({
                        ...current,
                        movementSpeed: preset.value,
                      }))
                    }
                    className={`island-button min-h-9 px-3 py-1.5 text-xs ${
                      selected ? "island-button--primary" : "island-button--soft"
                    }`}
                  >
                    {selected ? (
                      <IslandIcon name="check" className="h-3.5 w-3.5" />
                    ) : null}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {!isBuiltin ? (
        <section className="island-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-sky/40">
              <IslandIcon name="drag" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-island-ink">
                Window attach offset
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-island-muted">
                Fine-tune wall grabs, underside crawls, and title-bar sits.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="island-form-section">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={wallOffsetInputId}
                  className="text-sm font-extrabold text-island-ink"
                >
                  Walls
                </label>
                <output htmlFor={wallOffsetInputId} className="island-badge">
                  {surfaceOffsets.wall}px
                </output>
              </div>
              <input
                id={wallOffsetInputId}
                type="range"
                min={-80}
                max={80}
                step={1}
                value={surfaceOffsets.wall}
                aria-valuetext={`${surfaceOffsets.wall} pixels`}
                onChange={(event) =>
                  onSurfaceOffsetsChange((current) => ({
                    ...current,
                    wall: Number(event.target.value),
                  }))
                }
                className="island-slider mt-4 w-full"
              />
              <span className="mt-2 flex justify-between text-[10px] font-bold text-island-muted">
                <span>Inside</span>
                <span>Outside</span>
              </span>
            </div>

            <div className="island-form-section">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={ceilingOffsetInputId}
                  className="text-sm font-extrabold text-island-ink"
                >
                  Ceilings
                </label>
                <output
                  htmlFor={ceilingOffsetInputId}
                  className="island-badge"
                >
                  {surfaceOffsets.ceiling}px
                </output>
              </div>
              <input
                id={ceilingOffsetInputId}
                type="range"
                min={-80}
                max={80}
                step={1}
                value={surfaceOffsets.ceiling}
                aria-valuetext={`${surfaceOffsets.ceiling} pixels`}
                onChange={(event) =>
                  onSurfaceOffsetsChange((current) => ({
                    ...current,
                    ceiling: Number(event.target.value),
                  }))
                }
                className="island-slider mt-4 w-full"
              />
              <span className="mt-2 flex justify-between text-[10px] font-bold text-island-muted">
                <span>Inside</span>
                <span>Outside</span>
              </span>
            </div>

            <div className="island-form-section">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={titleBarOffsetInputId}
                  className="text-sm font-extrabold text-island-ink"
                >
                  Title bars
                </label>
                <output
                  htmlFor={titleBarOffsetInputId}
                  className="island-badge"
                >
                  {surfaceOffsets.titleBar}px
                </output>
              </div>
              <input
                id={titleBarOffsetInputId}
                type="range"
                min={-80}
                max={80}
                step={1}
                value={surfaceOffsets.titleBar}
                aria-valuetext={`${surfaceOffsets.titleBar} pixels`}
                onChange={(event) =>
                  onSurfaceOffsetsChange((current) => ({
                    ...current,
                    titleBar: Number(event.target.value),
                  }))
                }
                className="island-slider mt-4 w-full"
              />
              <span className="mt-2 flex justify-between text-[10px] font-bold text-island-muted">
                <span>Higher</span>
                <span>Lower</span>
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {canEditAnimations ? (
        <section className="island-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-island-ink/20 bg-island-rose/45">
              <IslandIcon name="edit" className="h-5 w-5" />
            </span>
            <div>
              <span className="island-badge mb-2 bg-island-custard">
                {characterSource === "shimeji"
                  ? "Shimeji action mapping"
                  : "Animation frames"}
              </span>
              <h2 className="text-lg font-extrabold text-island-ink">
                Animation studio
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-island-muted">
                {editAnimationDescription}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onEditFrames}
              className="island-button island-button--primary"
            >
              <IslandIcon name="edit" className="h-4 w-4" />
              {editAnimationLabel}
            </button>
            {characterSource === "tomoji" ? (
              <button
                type="button"
                onClick={() => void openCharacterFolder(characterId)}
                className="island-button island-button--soft"
              >
                <IslandIcon name="folder" className="h-4 w-4" />
                Open folder
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
