import { cn } from "@/utils/style";
import ProgressBar from "./ProgressBar";

export type HoverTooltipTone = "ok" | "warning" | "danger" | "info";

const DOT = {
  ok: "bg-dt-ok",
  warning: "bg-dt-warn",
  danger: "bg-dt-danger",
  info: "bg-dt-info",
} as const;

const INK = {
  ok: "text-dt-ok",
  warning: "text-dt-warn",
  danger: "text-dt-danger",
  info: "text-dt-info",
} as const;

const BAR_TONE = {
  ok: "ok",
  warning: "warn",
  danger: "danger",
  info: "info",
} as const;

type HoverTooltipProps = {
  title: string;
  status?: { label: string; tone: HoverTooltipTone };
  /** 블록 점유율은 점과 글자 모두 상태색. 그 외 글자는 text-2 */
  statusColored?: boolean;
  rows?: { label: string; value: string }[];
  progress?: { value: number; tone?: HoverTooltipTone };
  className?: string;
};

/** 3D 위 호버 카드. 제목, 상태 점, 구분선, 행 */
export default function HoverTooltip({
  title,
  status,
  statusColored = false,
  rows,
  progress,
  className,
}: HoverTooltipProps) {
  const barTone = progress?.tone ?? status?.tone ?? "info";
  return (
    <div
      className={cn(
        "w-max min-w-[200px] max-w-[240px] rounded-lg bg-dt-bg/92 px-3 py-3 text-dt-text shadow-[inset_0_0_0_2px_#ffffff1a]",
        className,
      )}
    >
      <p className="truncate text-[14px] font-medium">{title}</p>
      {status ? (
        <div className="mt-1 flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", DOT[status.tone])} />
          <span className={cn("text-[12px] font-normal", statusColored ? INK[status.tone] : "text-dt-text-2")}>
            {status.label}
          </span>
        </div>
      ) : null}
      {rows && rows.length > 0 ? <div className="my-2 h-px bg-white/8" /> : null}
      {rows?.map((row) => (
        <div key={row.label} className="flex h-5 items-center justify-between gap-3">
          <span className="text-[12px] font-normal text-dt-text-3">{row.label}</span>
          <span className="min-w-0 truncate text-[12px] font-medium">{row.value}</span>
        </div>
      ))}
      {progress ? <ProgressBar className="mt-2" value={progress.value} tone={BAR_TONE[barTone]} /> : null}
    </div>
  );
}
