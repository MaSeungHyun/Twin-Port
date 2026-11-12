import InfoTip from "@/components/InfoTip";
import { cn } from "@/utils/style";
import type { ReactNode } from "react";

type CyberPanelProps = {
  children: ReactNode;
  className?: string;
};

/** 선석 등 남은 패널 프레임. 코너 장식 없이 공통 패널 표면 */
export default function CyberPanel({ children, className }: CyberPanelProps) {
  return (
    <div className={cn("hud-glass relative overflow-hidden rounded-[14px] text-dt-text", className)}>
      {children}
    </div>
  );
}

export function CyberHeading({
  title,
  subtitle,
  className,
  trailing,
  info,
}: {
  title: string;
  /** 타이틀 옆 인포 아이콘 툴팁 */
  info?: string;
  subtitle?: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <header
      className={cn("shrink-0 border-b border-white/8 px-6 py-3", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[16px] font-medium text-dt-text">
            {title}
            {info ? <InfoTip text={info} className="text-[14px]" /> : null}
          </h2>
          {subtitle ? (
            <div className="mt-1 text-[12px] text-dt-text-2">{subtitle}</div>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
      </div>
    </header>
  );
}
