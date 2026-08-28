import { cn } from "@/utils/style";
import { LEVEL_FILTER_STYLES, type LevelFilterKey } from "./constants";

const SIZE_STYLES = {
  md: {
    root: "gap-md",
    button: "gap-xs rounded-md px-sm py-xs text-lg",
    dot: "size-xs",
  },
  sm: {
    root: "gap-xs",
    button: "gap-0.5 rounded-sm px-sm py-1 text-sm",
    dot: "size-1.5",
  },
} as const;

export type LevelFilterProps<K extends LevelFilterKey> = {
  ariaLabel: string;
  levels: readonly K[];
  counts: Record<K, number>;
  value: Record<K, boolean>;
  onChange: (level: K) => void;
  className?: string;
  size?: keyof typeof SIZE_STYLES;
  /** Dropdown 내부 등 — pointerDown 기본 동작 방지 */
  preventPointerDown?: boolean;
};

export default function LevelFilter<K extends LevelFilterKey>({
  ariaLabel,
  levels,
  counts,
  value,
  onChange,
  className,
  size = "md",
  preventPointerDown = false,
}: LevelFilterProps<K>) {
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex shrink-0 flex-wrap items-center",
        sizeStyle.root,
        className,
      )}
      onPointerDown={
        preventPointerDown ? (event) => event.preventDefault() : undefined
      }
    >
      {levels.map((level) => {
        const { label, colorClass, dotClass, activeClass } =
          LEVEL_FILTER_STYLES[level];
        const active = value[level];

        return (
          <button
            key={level}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(level)}
            className={cn(
              "inline-flex cursor-pointer items-center border transition-colors",
              sizeStyle.button,
              "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              colorClass,
              active
                ? activeClass
                : "border-white/10 bg-black/25 opacity-45 line-through decoration-current/35 hover:opacity-70",
            )}
          >
            <span
              className={cn("shrink-0 rounded-full", sizeStyle.dot, dotClass)}
              aria-hidden
            />
            <span className="font-semibold">{label}</span>
            <span className="tabular-nums font-bold">{counts[level]}</span>
          </button>
        );
      })}
    </div>
  );
}
