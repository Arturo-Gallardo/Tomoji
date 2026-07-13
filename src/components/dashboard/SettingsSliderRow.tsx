import { useId } from "react";

interface SettingsSliderRowProps {
  label: string;
  description?: string;
  value: number;
  valueLabel?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function SettingsSliderRow({
  label,
  description,
  value,
  valueLabel,
  disabled = false,
  onChange,
}: SettingsSliderRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  const displayValue = valueLabel ?? `${Math.round(value * 100)}%`;

  return (
    <div
      className="grid gap-4 border-t-2 border-island-ink/10 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center"
      aria-disabled={disabled || undefined}
    >
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-extrabold text-island-ink">
          {label}
        </p>
        {description ? (
          <p
            id={descriptionId}
            className="mt-1 text-xs font-medium leading-relaxed text-island-muted"
          >
            {description}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-island-muted">
            Amount
          </span>
          <output className={`island-badge ${disabled ? "border-dashed" : ""}`}>
            {disabled ? `Unavailable (${displayValue})` : displayValue}
          </output>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          aria-valuetext={displayValue}
          onChange={(event) => onChange(Number(event.target.value))}
          className="island-slider w-full disabled:cursor-not-allowed disabled:opacity-45"
        />
      </div>
    </div>
  );
}
