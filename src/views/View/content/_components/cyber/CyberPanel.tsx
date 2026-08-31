import { cn } from "@/utils/style";
import type { ReactNode } from "react";

type CyberPanelProps = {
  children: ReactNode;
  className?: string;
};

/** 사이버틱 HUD 프레임 — 코너 브래킷 + 해치 텍스처 */
export default function CyberPanel({ children, className }: CyberPanelProps) {
  return (
    <div className={cn("cyber-panel relative isolate overflow-hidden", className)}>
      <CyberCorners />
      {children}
    </div>
  );
}

export function CyberCorners() {
  return (
    <>
      <span aria-hidden className="cyber-corner cyber-corner--tl" />
      <span aria-hidden className="cyber-corner cyber-corner--tr" />
      <span aria-hidden className="cyber-corner cyber-corner--bl" />
      <span aria-hidden className="cyber-corner cyber-corner--br" />
    </>
  );
}

export function CyberHeading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "shrink-0 border-b border-cyber/15 px-xl py-sm",
        className,
      )}
    >
      <h2 className="cyber-heading text-xl">{title}</h2>
      {subtitle ? (
        <p className="cyber-subheading mt-0.5">{subtitle}</p>
      ) : null}
    </header>
  );
}
