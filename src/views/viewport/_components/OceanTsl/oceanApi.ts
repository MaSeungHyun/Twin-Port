import { useSettings } from "./state/settingsStore";

/** 바다 런타임 공유 상태 — OceanTsl(leva)이 갱신, 부력이 읽음 */
export const oceanState = {
  level: 15.29,
  visible: true,
  buoyancy: true,
  /** FFT 유의파고 (Ocean.tsx 에서 sim.hs 로 갱신) */
  hs: 1,
  /** [twin-port] 선체 접촉 거품용: 중심 x/z, yaw, 반길이 hx/hz (world 축 기준 로컬), on */
  ship: { x: 0, z: 0, yaw: 0, hx: 0, hz: 0, on: false },
  /** [twin-port] 실제 선체 수선면 윤곽: 길이축(axis 0=x,1=z) 구간 [a0,a1] 을 SHIP_BINS 로 나눈 횡방향 [lo,hi] (선박 로컬, m) */
  shipProfile: null as null | { axis: 0 | 1; a0: number; a1: number; lo: Float32Array; hi: Float32Array; ver: number },
};
export const SHIP_BINS = 64;
/** 선박 로컬 삼각형들을 수면 높이(로컬 y)에서 잘라 수선면 윤곽 프로파일 생성 */
export function buildShipProfile(tris: Float32Array[], wlY: number, axis: 0 | 1) {
  const pts: number[] = [];
  let a0 = Infinity, a1 = -Infinity;
  const A = axis === 0 ? 0 : 2, Lt = axis === 0 ? 2 : 0;
  for (const t of tris)
    for (let i = 0; i < t.length; i += 9) {
      const P: number[][] = [];
      for (const [p, q] of [[0, 3], [3, 6], [6, 0]]) {
        const py = t[i + p! + 1]! - wlY, qy = t[i + q! + 1]! - wlY;
        if (py * qy > 0 || py === qy) continue;
        const k = py / (py - qy);
        P.push([t[i + p! + A]! + (t[i + q! + A]! - t[i + p! + A]!) * k, t[i + p! + Lt]! + (t[i + q! + Lt]! - t[i + p! + Lt]!) * k]);
      }
      // 교차 선분을 촘촘히 샘플 (빈 bin 방지)
      if (P.length >= 2) for (let s = 0, ns = Math.max(1, Math.ceil(Math.hypot(P[1]![0]! - P[0]![0]!, P[1]![1]! - P[0]![1]!) / 0.5)); s <= ns; s++) { const a = P[0]![0]! + (P[1]![0]! - P[0]![0]!) * s / ns, l = P[0]![1]! + (P[1]![1]! - P[0]![1]!) * s / ns; pts.push(a, l); a0 = Math.min(a0, a); a1 = Math.max(a1, a); }
    }
  if (!(a1 > a0)) return null;
  const lo = new Float32Array(SHIP_BINS).fill(Infinity), hi = new Float32Array(SHIP_BINS).fill(-Infinity);
  for (let i = 0; i < pts.length; i += 2) {
    const b = Math.min(SHIP_BINS - 1, Math.floor(((pts[i]! - a0) / (a1 - a0)) * SHIP_BINS));
    lo[b] = Math.min(lo[b]!, pts[i + 1]!); hi[b] = Math.max(hi[b]!, pts[i + 1]!);
  }
  // 빈 bin 은 이웃으로 채움
  for (let b = 0; b < SHIP_BINS; b++) if (!Number.isFinite(lo[b]!)) {
    let l = b - 1, r = b + 1;
    while (l >= 0 && !Number.isFinite(lo[l]!)) l--;
    while (r < SHIP_BINS && !Number.isFinite(lo[r]!)) r++;
    const src = l >= 0 ? l : r < SHIP_BINS ? r : -1;
    if (src < 0) { lo[b] = 0; hi[b] = 0; } else { lo[b] = lo[src]!; hi[b] = hi[src]!; }
  }
  return { axis, a0, a1, lo, hi, ver: Math.random() };
}

/** 셰이더 uTime 과 같은 시계 (Ocean.tsx useFrame 에서 갱신) */
export const oceanClock = { t: 0 };

/**
 * [twin-port] main 브랜치 바다는 GPU FFT 만 있고 CPU 높이 샘플러가 없음 →
 * 선박 부력용 간단 절차 파 (풍향/유의파고 기반 긴 너울 3개). 실제 수면과 위상은 일치하지 않음(완만한 흔들림 용도).
 */
const SW = [
  { L: 140, a: 0.5, d: 0, p: 0 },
  { L: 90, a: 0.3, d: 0.5, p: 1.7 },
  { L: 60, a: 0.2, d: -0.6, p: 4.1 },
];
export function sampleOceanHeight(x: number, z: number, t = oceanClock.t) {
  const dir = useSettings.getState().params.windDir;
  const amp = Math.min(oceanState.hs, 6) * 0.25;
  let h = 0;
  for (const w of SW) {
    const k = (2 * Math.PI) / w.L, om = Math.sqrt(9.81 * k), a = dir + w.d;
    h += w.a * amp * Math.sin(k * (Math.cos(a) * x + Math.sin(a) * z) - om * t + w.p);
  }
  return h;
}
export const sampleOceanY = (x: number, z: number, t = oceanClock.t) => oceanState.level + sampleOceanHeight(x, z, t);
