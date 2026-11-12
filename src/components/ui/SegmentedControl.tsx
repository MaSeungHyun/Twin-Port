import { cn } from "@/utils/style";

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  label?: string;
  hint?: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/** 활성: 포인트 16% 배경 + 50% 안쪽 테두리, 글자는 밝은 포인트색 */
export default function SegmentedControl<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-normal text-dt-text">{label}</span>
          {hint ? <span className="text-[10px] font-medium text-dt-text-3">{hint}</span> : null}
        </div>
      ) : null}
      <div className="flex h-9 items-center rounded-lg bg-white/4 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "h-7 min-w-0 flex-1 rounded-md text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                active ? "dt-active" : "text-dt-text-2 hover:bg-white/6",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
