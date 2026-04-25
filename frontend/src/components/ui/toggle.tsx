import { cn } from "@/lib/cn";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Toggle({ value, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        value ? "bg-cyan" : "bg-white/10"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          value ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
