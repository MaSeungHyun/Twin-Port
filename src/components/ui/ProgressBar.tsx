import { cn } from "@/utils/style";

const FILL = {
  info: "bg-dt-info",
  ok: "bg-dt-ok",
  warn: "bg-dt-warn",
  danger: "bg-dt-danger",
  point: "bg-dt-point",
} as const;

type ProgressBarProps = {
  /** 0–100 */
  value: number;
  tone?: keyof typeof FILL;
  className?: string;
};

export default function ProgressBar({ value, tone = "info", className }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1 overflow-hidden rounded-sm bg-white/14", className)}>
      <div className={cn("h-full rounded-[2px]", FILL[tone])} style={{ width: `${width}%` }} />
    </div>
  );
}
