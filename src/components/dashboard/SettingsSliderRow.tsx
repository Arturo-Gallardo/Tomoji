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
  return (
    <label className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-center">
      <span>
        <span className="block text-sm text-neutral-200">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs text-neutral-500">
            {description}
          </span>
        ) : null}
      </span>

      <span className="block">
        <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          <span>Amount</span>
          <span>{valueLabel ?? `${Math.round(value * 100)}%`}</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full disabled:opacity-40"
        />
      </span>
    </label>
  );
}
