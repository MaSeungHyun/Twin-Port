import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { CAMERA_INTRO_START_EVENT } from "@/constants/cameraIntro";
import Button from "@/components/Button";

/**
 * [camintro] "관제 시작" intro overlay — viewport only, semi-transparent so the scene (camera at slot 1) shows through.
 * Appears once per page load after loading finishes; click / Enter / Space → 400 ms fade + camera flight to slot 2.
 * Does NOT toggle header Monitoring Mode (that one disables orbit controls and hides panels).
 */
const FADE_MS = 400;
const SHOW_DELAY_MS = 700; // ViewLoader dismiss (~280 ms) + slot-1 placement (~30 frames)

export default function IntroOverlay() {
  const { active, loaded } = useProgress();
  const [phase, setPhase] = useState<"wait" | "show" | "fading" | "done">(
    "wait",
  );
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase !== "wait" || active || loaded === 0) return;
    const t = window.setTimeout(() => setPhase("show"), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase, active, loaded]);

  useEffect(() => {
    if (phase === "show") btn.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = () => {
    if (phase !== "show") return;
    // [pt121u] hide instantly (same frame) and unmount; camera flight starts as before
    setPhase("done");
    window.dispatchEvent(new CustomEvent(CAMERA_INTRO_START_EVENT));
  };

  useEffect(() => {
    if (phase !== "show") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        el !== btn.current &&
        (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      )
        return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (phase === "wait" || phase === "done") return null;

  return (
    <div
      className="bg-black/50 absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      <div className="flex flex-col items-center">
        <Button
          ref={btn}
          type="button"
          className="bg-primary/80 text-white px-12 py-4 text-4xl hover:text-white/50 rounded-lg"
          onClick={start}
        >
          관제 시작
        </Button>
      </div>
    </div>
  );
}
