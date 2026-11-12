/**
 * [load] 화면 렌더 게이트. 로딩 중에는 캔버스(화면) 렌더를 건너뛰어 "첫 렌더가 씬 전체 노드/파이프라인을 한 번에 빌드"하는
 * 수 초짜리 long task 를 없앰. 예열(SceneWarmup)이 객체별로 나눠 컴파일한 뒤 열림. RT 렌더(FFT/프로브 등)는 항상 통과.
 */
import { loadMark, loadTracing } from "@/debug/loadTiming";
import { shareInstanceShaders } from "@/domain/shareInstanceShaders";

let open = false;
const SAFETY_MS = 90_000;
const safety = typeof window !== "undefined" ? window.setTimeout(() => openRenderGate("safety-timeout"), SAFETY_MS) : 0;

export const isRenderGateOpen = () => open;

let screenWaiters: ((ms: number) => void)[] = [];
/** 다음 화면 렌더가 끝나면 그 렌더에 걸린 시간(ms)으로 resolve. 타임아웃이면 -1. */
export function nextScreenRender(timeoutMs = 4000) {
  return new Promise<number>((resolve) => {
    let settled = false;
    const finish = (ms: number) => {
      if (settled) return;
      settled = true;
      resolve(ms);
    };
    const timer = window.setTimeout(() => finish(-1), timeoutMs);
    screenWaiters.push((ms) => {
      window.clearTimeout(timer);
      finish(ms);
    });
  });
}
function settleScreenWaiters(ms: number) {
  if (screenWaiters.length === 0) return;
  const list = screenWaiters;
  screenWaiters = [];
  for (const resolve of list) resolve(ms);
}
export function openRenderGate(reason: string) {
  if (open) return;
  open = true;
  if (safety) window.clearTimeout(safety);
  loadMark("render-gate-open", reason);
}

type Gl = {
  info?: { render: { drawCalls: number; triangles: number }; memory: { programs: number } };
  render: (s: unknown, c: unknown) => unknown;
  compileAsync?: (o: unknown, c: unknown, s?: unknown) => Promise<unknown>;
  getRenderTarget: () => unknown;
};

/** renderer.render / compileAsync 래핑: 게이트 + 느린 호출 계측 */
export function instrumentRenderer(renderer: unknown) {
  shareInstanceShaders(renderer as { backend?: { capabilities?: { getUniformBufferLimit?: () => number } } });
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
    if (!screen) return render(s, c);
    const t0 = performance.now();
    const programs = r.info?.memory.programs ?? 0;
    const out = render(s, c);
    const d = performance.now() - t0;
    settleScreenWaiters(d);
    if (!loadTracing()) return out;
    if (after < 5 || d > 50) {
      const draws = r.info?.render.drawCalls;
      const tris = r.info?.render.triangles;
      console.info(`[load] screen render #${after} start@${t0.toFixed(0)} ${d.toFixed(0)}ms programs+${(r.info?.memory.programs ?? 0) - programs} draws=${draws} tris=${tris}${after === 0 ? ` (게이트 동안 건너뛴 프레임 ${skipped})` : ""}`);
      if (after === 0) loadMark(`screen render draws ${draws} tris ${tris} ${d.toFixed(0)}ms`);
    }
    after++;
    return out;
  };
  const compile = r.compileAsync?.bind(r);
  if (compile && loadTracing()) {
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
