import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";

/**
 * 전체 뷰(React DOM) 로딩 오버레이.
 * loaded/total은 파일 단위로 튀므로, 표시 %는 rAF로 목표값에 보간한다.
 */
export default function ViewLoader() {
  const { active, loaded, total } = useProgress();
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [displayPercent, setDisplayPercent] = useState(0);
  const displayRef = useRef(0);

  if ((active || loaded > 0) && !started) {
    setStarted(true);
  }
  if (active && dismissed) {
    setDismissed(false);
  }

  const targetPercent = !active
    ? 100
    : total > 0
      ? Math.min(100, (loaded / total) * 100)
      : 0;

  useEffect(() => {
    if (!started) return;

    let frame = 0;

    const tick = () => {
      const current = displayRef.current;
      const delta = targetPercent - current;
      const next =
        Math.abs(delta) < 0.2
          ? targetPercent
          : current + delta * 0.12;

      displayRef.current = next;
      setDisplayPercent(next);

      if (next < 99.95 || Math.abs(targetPercent - next) > 0.05) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, targetPercent]);

  useEffect(() => {
    if (!started || active) return;
    if (displayPercent < 99.5) return;

    const timer = window.setTimeout(() => setDismissed(true), 280);
    return () => window.clearTimeout(timer);
  }, [started, active, displayPercent]);

  if (!started || dismissed) return null;

  const percent = Math.round(displayPercent);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <p className="mb-3 text-sm font-medium tracking-wide text-white/80">
        Loading …
      </p>
      <div className="h-1 w-52 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary will-change-[width]"
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      <p className="mt-2 tabular-nums text-xs text-white/50">{percent}%</p>
    </div>
  );
}
