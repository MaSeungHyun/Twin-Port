import { cn } from "@/utils/style";
import type { ReactNode } from "react";

type CyberPanelProps = {
  children: ReactNode;
  className?: string;
};

const cyberPanelClass =
  "relative isolate overflow-hidden border border-cyber/20 bg-[linear-gradient(168deg,rgba(4,12,24,0.54)_0%,rgba(2,6,14,0.9)_100%)] shadow-[inset_0_0_60px_rgba(0,100,180,0.07),0_0_30px_rgba(0,232,255,0.05)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[repeating-linear-gradient(-45deg,transparent_0_6px,rgba(0,232,255,0.9)_6px_7px)] before:opacity-[0.035] before:content-[''] before:[mask-image:linear-gradient(to_left,#000_0%,transparent_55%)]";

const cyberCornerBase =
  "pointer-events-none absolute z-2 size-3.5 border-cyber";

/** 사이버틱 HUD 프레임 — 코너 브래킷 + 해치 텍스처 */
export default function CyberPanel({ children, className }: CyberPanelProps) {
  return (
    <div className={cn(cyberPanelClass, className)}>
      <CyberCorners />
      {children}
    </div>
  );
}

export function CyberCorners() {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          cyberCornerBase,
          "top-0 left-0 border-t-2 border-l-2 shadow-[-2px_-2px_10px_rgba(0,232,255,0.45)]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          cyberCornerBase,
          "top-0 right-0 border-t-2 border-r-2 shadow-[2px_-2px_10px_rgba(0,232,255,0.45)]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          cyberCornerBase,
          "bottom-0 left-0 border-b-2 border-l-2 shadow-[-2px_2px_10px_rgba(0,232,255,0.45)]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          cyberCornerBase,
          "right-0 bottom-0 border-r-2 border-b-2 shadow-[2px_2px_10px_rgba(0,232,255,0.45)]",
        )}
      />
    </>
  );
}

export function CyberHeading({
  title,
  subtitle,
  className,
  trailing,
}: {
  title: string;
  subtitle?: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <header
      className={cn("shrink-0 border-b border-cyber/15 px-xl py-sm", className)}
    >
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="cyber-heading text-2xl">{title}</h2>
          {subtitle ? (
            <div className="mt-0.5 text-text-secondary">{subtitle}</div>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
      </div>
    </header>
  );
}
