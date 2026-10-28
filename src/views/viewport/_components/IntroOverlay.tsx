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
      className="tp-intro absolute inset-0 z-[60] flex items-center justify-center"
      style={{
        opacity: phase === "fading" ? 0 : 1,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      <style>{`
        .tp-intro{background:rgba(5,12,20,.45);will-change:opacity;transition:opacity ${FADE_MS}ms ease;font-family:"Pretendard","Noto Sans KR",ui-sans-serif,sans-serif;animation:tp-intro-in .5s ease both}
        @keyframes tp-intro-in{from{opacity:0}to{opacity:1}}
        .tp-intro-btn{min-width:220px;padding:18px 44px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(53,117,220,.82);color:#fff;font:600 22px/1 "Pretendard","Noto Sans KR",sans-serif;letter-spacing:.06em;cursor:pointer;box-shadow:0 10px 34px rgba(53,117,220,.35),inset 0 1px 0 rgba(255,255,255,.2);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
        .tp-intro-btn:hover{background:rgba(53,117,220,1);transform:translateY(-2px);box-shadow:0 14px 40px rgba(53,117,220,.5),inset 0 1px 0 rgba(255,255,255,.25)}
        .tp-intro-btn:active{transform:translateY(0) scale(.97);background:#2b63bd}
        .tp-intro-btn:focus-visible{outline:2px solid rgba(255,255,255,.85);outline-offset:4px}
        .tp-intro-sub{margin-top:14px;color:rgba(255,255,255,.55);font-size:13px;letter-spacing:.04em;text-align:center}
      `}</style>
      <div className="flex flex-col items-center">
        <Button
          ref={btn}
          type="button"
          className="tp-intro-btn"
          onClick={start}
        >
          관제 시작
        </Button>
      </div>
    </div>
  );
}
