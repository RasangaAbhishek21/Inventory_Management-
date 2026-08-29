"use client";

/**
 * Quantity entry: − [ input ] + . Never a bare text field (brief §9). 48px targets,
 * numeric input, ≥18px digits, tabular figures.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  ariaLabel = "Quantity",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const clamp = (n: number) => {
    if (Number.isNaN(n)) return min;
    if (n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(clamp(value - 1))}
        className="w-12 rounded-lg border border-ink text-xl font-semibold"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
        className="num w-20 rounded-lg border border-sand bg-surface text-center"
      />
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(clamp(value + 1))}
        className="w-12 rounded-lg border border-ink text-xl font-semibold"
      >
        +
      </button>
    </div>
  );
}
