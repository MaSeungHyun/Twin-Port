import { cn } from "@/utils/style";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PanelMotion = "enter" | "swap-in" | "swap-out" | "exit";

const MotionContext = createContext<PanelMotion>("enter");
const PhaseContext = createContext<"in" | "out">("in");

export function PanelMotionProvider({ value, children }: { value: PanelMotion; children: ReactNode }) {
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function usePanelMotion() {
  return useContext(MotionContext);
}

export function usePresencePhase() {
  return useContext(PhaseContext);
}

export function leftMotionClass(motion: PanelMotion) {
  if (motion === "swap-in") return "presence-fade-in";
  if (motion === "swap-out") return "presence-fade-out pointer-events-none";
  if (motion === "exit") return "presence-left-out pointer-events-none";
  return "presence-left-in";
}

export function rightMotionClass(motion: PanelMotion, closing: boolean) {
  if (motion === "swap-out" || motion === "exit" || closing) return "presence-right-out pointer-events-none";
  return "presence-right-in";
}

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type PresenceProps = {
  present: boolean;
  /** hold 는 자식이 직접 닫힘 클래스를 입힌다. 나머지는 래퍼가 움직인다 */
  variant: "left" | "right" | "pop" | "hold";
  className?: string;
  children: ReactNode;
};

/** 닫힘 애니메이션이 끝날 때까지 마운트를 유지한다 */
export default function Presence({ present, variant, className, children }: PresenceProps) {
  const [mounted, setMounted] = useState(present);
  const [phase, setPhase] = useState<"in" | "out">(present ? "in" : "out");

  useEffect(() => {
    if (present) {
      setMounted(true);
      setPhase("in");
      return;
    }
    if (reduced()) {
      setMounted(false);
      return;
    }
    setPhase("out");
  }, [present]);

  useEffect(() => {
    if (phase !== "out" || present) return;
    const ms = reduced() ? 0 : variant === "pop" ? 120 : 160;
    const timer = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(timer);
  }, [phase, present, variant]);

  if (!mounted) return null;
  const motion =
    variant === "hold"
      ? undefined
      : phase === "in"
        ? variant === "left"
          ? "presence-left-in"
          : variant === "right"
            ? "presence-right-in"
            : "presence-pop-in"
        : variant === "left"
          ? "presence-left-out"
          : variant === "right"
            ? "presence-right-out"
            : "presence-pop-out";

  return (
    <PhaseContext.Provider value={phase}>
      <div className={cn(className, motion, phase === "out" && "pointer-events-none")}>{children}</div>
    </PhaseContext.Provider>
  );
}
