import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { openRenderGate } from "@/domain/renderGate";
import {
  useSceneWarmStage,
  type SceneWarmStage,
} from "@/views/viewport/_components/Port/WaterReflection";

/** [loader] 예열이 끝나지 않아도 리소스 로딩 종료 후 이 시간(ms)이 지나면 닫음 (IntroOverlay 안전장치와 동일) */
const WARM_TIMEOUT_MS = 15000;

/** 현재 로딩 중인 파일(drei useProgress item) → 한국어 단계 문구 */
function itemLabel(item: string) {
  const u = item.toLowerCase().split("?")[0] ?? "";
  if (/basis_transcoder|draco|meshopt|\.wasm$/.test(u)) return "디코더 준비 중…";
  if (/\.(glb|gltf|bin)$/.test(u)) return "모델 불러오는 중…";
  if (/\.(hdr|exr)$/.test(u)) return "환경광(HDRI) 불러오는 중…";
  if (/\.(ktx2|basis|png|jpe?g|webp|avif)$/.test(u)) return "텍스처 처리 중…";
  return "리소스 불러오는 중…";
}

function warmLabel(stage: SceneWarmStage) {
  if (stage === "build") return "반사 준비 중…";
  if (stage === "compile") return "셰이더 컴파일 중…";
  return "씬 예열 중…";
}

/**
 * 전체 뷰(React DOM) 로딩 오버레이. [pt313u]
 * 무한 회전 스피너(CSS transform → 메인 스레드가 바빠도 컴포지터에서 회전) + 현재 작업 단계 문구.
 * 리소스 로딩 → 반사 메시 생성 → 셰이더 컴파일(SceneWarmup)까지 끝나야 닫힘.
 */
export default function ViewLoader() {
  const { active, loaded, item } = useProgress();
  const warmStage = useSceneWarmStage();
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  if ((active || loaded > 0) && !started) setStarted(true);
  if (active && dismissed) setDismissed(false);

  const loadingDone = started && !active;
  const finished = loadingDone && (warmStage === "done" || timedOut);

  useEffect(() => {
    if (!loadingDone) return;
    const t = window.setTimeout(() => setTimedOut(true), WARM_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loadingDone]);

  // [perf] dev: 로딩 중 메인 스레드 long task(>50ms) 기록 → 끝나면 요약
  useEffect(() => {
    if (dismissed) return;
    if (!import.meta.env.DEV || typeof PerformanceObserver === "undefined") return;
    if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
    const tasks: number[] = [];
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        tasks.push(e.duration);
        if (e.duration > 200) console.info(`[perf] long task ${e.duration.toFixed(0)}ms @${e.startTime.toFixed(0)}ms`);
      }
    });
    obs.observe({ type: "longtask", buffered: true });
    return () => {
      obs.disconnect();
      const sorted = [...tasks].sort((a, b) => b - a);
      console.info(
        `[perf] loading long tasks: ${tasks.length}, total ${tasks.reduce((a, b) => a + b, 0).toFixed(0)}ms, top`,
        sorted.slice(0, 8).map(Math.round),
      );
    };
  }, [dismissed]);

  useEffect(() => {
    if (!finished) return;
    openRenderGate(timedOut ? "loader-timeout" : "loader-finished"); // 예열 실패/타임아웃에도 화면이 비지 않게
    const t = window.setTimeout(() => setDismissed(true), 200);
    return () => window.clearTimeout(t);
  }, [finished]);

  if (!started || dismissed) return null;

  const label = active
    ? itemLabel(item ?? "")
    : finished
      ? "준비 완료"
      : warmLabel(warmStage);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div
        className="h-16 w-16 animate-spin rounded-full border-4 border-white/10 border-t-primary will-change-transform"
        role="progressbar"
        aria-label={label}
      />
      <p className="mt-md text-lg tracking-wide text-white/70" aria-live="polite">
        {label}
      </p>
    </div>
  );
}