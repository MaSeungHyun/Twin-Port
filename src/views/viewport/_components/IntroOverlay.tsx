import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { CAMERA_INTRO_START_EVENT } from "@/constants/cameraIntro";
import { useViewportStore } from "@/stores/viewport";
import Button from "@/components/Button";
import { useSceneWarmReady } from "./Port/WaterReflection";

/** [warm] 예열이 끝나지 않아도 이 시간(ms) 후엔 버튼 표시 (안전장치) */
const WARM_TIMEOUT_MS = 15000;

/**
 * [camintro] "관제 시작" intro overlay — viewport only, semi-transparent so the scene (camera at slot 1) shows through.
 * Appears once per page load after loading finishes; click / Enter / Space → 400 ms fade + camera flight to slot 2.
 * Does NOT toggle header Monitoring Mode (that one disables orbit controls and hides panels).
 */
const FADE_MS = 400;
const SHOW_DELAY_MS = 700; // ViewLoader dismiss (~280 ms) + slot-1 placement (~30 frames)

export default function IntroOverlay() {
  const { active, loaded } = useProgress();
  // [pt284u] 백드롭은 마운트 즉시(로딩 화면 아래부터) 깔림 → 로딩 종료 시 장면이 가려지지 않은 틈 없음.
  // "wait" = 백드롭 + 비활성 '준비 중…' 버튼, "show" = 버튼 활성
  const [phase, setPhase] = useState<"wait" | "show" | "fading" | "done">(
    "wait",
  );
  const btn = useRef<HTMLButtonElement>(null);
  // [warm] 반사/숨김 오브젝트 셰이더 예열 완료 전엔 '관제 시작' 미표시 (시작 비행 중 컴파일 끊김 방지)
  const warmReady = useSceneWarmReady();
  const [warmTimedOut, setWarmTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWarmTimedOut(true), WARM_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "wait" || active || loaded === 0) return;
    if (!warmReady && !warmTimedOut) return;
    const t = window.setTimeout(() => setPhase("show"), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase, active, loaded, warmReady, warmTimedOut]);

  useEffect(() => {
    if (phase === "show") btn.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = () => {
    if (phase !== "show") return;
    // [pt121u] hide instantly (same frame) and unmount; camera flight starts as before
    setPhase("done");
    useViewportStore.getState().startMonitoring(); // [monitorgate]
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

  if (phase === "done") return null;
  const ready = phase === "show";

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
          className={
            "bg-primary/80 text-white px-12 py-4 text-4xl rounded-lg " +
            (ready ? "hover:text-white/50" : "opacity-60 cursor-wait")
          }
          disabled={!ready}
          aria-busy={!ready}
          onClick={start}
        >
          {ready ? (
            <>
              관제 시작
            </>
          ) : (
            "준비 중…"
          )}
        </Button>
      </div>
    </div>
  );
}
