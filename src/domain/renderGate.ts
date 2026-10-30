/**
 * [load] 화면 렌더 게이트. 로딩 중에는 캔버스(화면) 렌더를 건너뛰어 "첫 렌더가 씬 전체 노드/파이프라인을 한 번에 빌드"하는
 * 수 초짜리 long task 를 없앰. 예열(SceneWarmup)이 객체별로 나눠 컴파일한 뒤 열림. RT 렌더(FFT/프로브 등)는 항상 통과.
 */
import { loadMark } from "@/debug/loadTiming";

let open = false;
const SAFETY_MS = 90_000;
const safety = typeof window !== "undefined" ? window.setTimeout(() => openRenderGate("safety-timeout"), SAFETY_MS) : 0;

export const isRenderGateOpen = () => open;
export function openRenderGate(reason: string) {
  if (open) return;
  open = true;
  if (safety) window.clearTimeout(safety);
  loadMark("render-gate-open", reason);
}

type Gl = {
  render: (s: unknown, c: unknown) => unknown;
  compileAsync?: (o: unknown, c: unknown, s?: unknown) => Promise<unknown>;
  getRenderTarget: () => unknown;
};

/** renderer.render / compileAsync 래핑: 게이트 + 느린 호출 계측 */
export function instrumentRenderer(renderer: unknown) {
  const r = renderer as Gl;
  const render = r.render.bind(r);
  let skipped = 0;
  let after = 0;
  r.render = (s, c) => {
    const screen = r.getRenderTarget() === null;
    if (screen && !open) {
      skipped++;
      return undefined;
    }
    if (!import.meta.env.DEV || !screen) return render(s, c);
    const t0 = performance.now();
    const out = render(s, c);
    const d = performance.now() - t0;
    if (after < 5 || d > 50) {
      console.info(`[load] screen render #${after} start@${t0.toFixed(0)} ${d.toFixed(0)}ms${after === 0 ? ` (게이트 동안 건너뛴 프레임 ${skipped})` : ""}`);
    }
    after++;
    return out;
  };
  const compile = r.compileAsync?.bind(r);
  if (compile && import.meta.env.DEV) {
    r.compileAsync = (o, c, s) => {
      const t0 = performance.now();
      const p = compile(o, c, s);
      const d = performance.now() - t0;
      // 개별 객체 예열(SceneWarmup)은 자체 로그 → 씬 단위 호출만 여기서
      if ((o as { isScene?: boolean }).isScene && d > 50) {
        console.info(`[load] compileAsync(scene "${(o as { name?: string }).name ?? ""}") sync ${d.toFixed(0)}ms @${t0.toFixed(0)}`);
      }
      return p;
    };
  }
}
