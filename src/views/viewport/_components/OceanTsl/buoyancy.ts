import * as THREE from "three";
import { oceanState, sampleOceanY } from "./oceanApi";

/** 선체 치수(m)와 흘수 */
export const SHIP_HULL = { length: 131, width: 19, draft: 4.9 } as const;
const NL = 5, NW = 3;

export interface BuoyState { heave: number; vh: number; px: number; vpx: number; pz: number; vpz: number; init: boolean }
export const makeBuoyState = (): BuoyState => ({ heave: 0, vh: 0, px: 0, vpx: 0, pz: 0, vpz: 0, init: false });

const spring = (x: number, v: number, target: number, w: number, dt: number) => {
  // 임계감쇠 스프링 (관성)
  const a = w * w * (target - x) - 2 * w * v;
  v += a * dt;
  return [x + v * dt, v] as const;
};

/**
 * 5x3 선체 샘플링 → heave(평균 수면 변위), 로컬 x/z 기울기 최소제곱 → 회전.
 * lengthAxis: 선체 길이 방향 로컬 축. 결과는 base pose 위에 더해짐 (기즈모 위치 유지).
 */
export function updateBuoyancy(
  s: BuoyState,
  base: { position: readonly number[]; rotation?: readonly number[] },
  lengthAxis: "x" | "z",
  dt: number,
) {
  {
    // [twin-port] 선체 거품 위치는 부력 on/off 와 무관하게 갱신
    const yaw0 = base.rotation?.[1] ?? 0;
    oceanState.ship.x = base.position[0]!; oceanState.ship.z = base.position[2]!; oceanState.ship.yaw = yaw0;
    oceanState.ship.hx = (lengthAxis === "x" ? SHIP_HULL.length : SHIP_HULL.width) / 2;
    oceanState.ship.hz = (lengthAxis === "x" ? SHIP_HULL.width : SHIP_HULL.length) / 2;
    oceanState.ship.on = true;
  }
  if (!oceanState.buoyancy || !oceanState.visible) {
    s.heave = s.vh = s.px = s.vpx = s.pz = s.vpz = 0;
    return s;
  }
  const yaw = base.rotation?.[1] ?? 0, c = Math.cos(yaw), sn = Math.sin(yaw);
  const [bx, , bz] = base.position;
  const hx = (lengthAxis === "x" ? SHIP_HULL.length : SHIP_HULL.width) / 2;
  const hz = (lengthAxis === "x" ? SHIP_HULL.width : SHIP_HULL.length) / 2;
  Object.assign(oceanState.ship, { x: bx!, z: bz!, yaw, hx, hz, on: true });
  const nx = lengthAxis === "x" ? NL : NW, nz = lengthAxis === "x" ? NW : NL;
  let sum = 0, sxh = 0, szh = 0, sxx = 0, szz = 0, n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -hx + (2 * hx * i) / (nx - 1), lz = -hz + (2 * hz * j) / (nz - 1);
    const h = sampleOceanY(bx! + lx * c + lz * sn, bz! - lx * sn + lz * c) - oceanState.level;
    sum += h; sxh += lx * h; szh += lz * h; sxx += lx * lx; szz += lz * lz; n++;
  }
  const heave = sum / n, slopeX = sxh / sxx, slopeZ = szh / szz;
  const tz = Math.atan(slopeX), tx = -Math.atan(slopeZ); // Z축 회전 = x방향 경사, X축 회전 = z방향 경사
  if (!s.init) { s.heave = heave; s.pz = tz; s.px = tx; s.init = true; }
  const st = Math.min(dt, 0.05);
  [s.heave, s.vh] = spring(s.heave, s.vh, heave, 2.2, st);
  [s.pz, s.vpz] = spring(s.pz, s.vpz, tz, 1.6, st);
  [s.px, s.vpx] = spring(s.px, s.vpx, tx, 1.6, st);
  return s;
}

const qb = new THREE.Quaternion(), qa = new THREE.Quaternion(), e = new THREE.Euler();
/** dummy(base pose 적용된 Object3D)에 부력 오프셋을 로컬 기준으로 합성 */
export function applyBuoyancy(obj: THREE.Object3D, s: BuoyState) {
  obj.position.y += s.heave;
  qb.setFromEuler(obj.rotation);
  qa.setFromEuler(e.set(s.px, 0, s.pz));
  obj.quaternion.copy(qb.multiply(qa));
}
