import { useId } from "react";

interface SettingsToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: SettingsToggleRowProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-3 border-t-2 border-island-ink/10 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <span
          className={`island-badge ${checked ? "bg-island-orange" : ""} ${
            disabled ? "border-dashed" : ""
          }`}
        >
          {disabled
            ? `Updating (${checked ? "On" : "Off"})`
            : checked
              ? "On"
              : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="island-toggle disabled:cursor-wait disabled:border-dashed disabled:opacity-60"
        >
          <span className="island-toggle-knob" />
        </button>
      </div>
    </div>
  );
}
