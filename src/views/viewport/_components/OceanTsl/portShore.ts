import * as THREE from "three";
import { SHORE_N, setShoreField } from "./scene/resources";
import { oceanState } from "./oceanApi";

const SKIP = /^(sky|plane)$|sky|water|ocean/i;
/**
 * 베이크 대상 = 지면형 메시만 (화이트리스트). 크레인(73m)/컨테이너/수목/펜스/위성 도시 메시(EXPORT_GOOGLE_SAT 최대 380m)/Cube 건물은
 * 높이장에 들어가면 해안 스워시가 물 표면을 그 높이까지 끌어올려 "땅 위로 바다가 솟는" 스파이크가 생김.
 */
const MAX_ABOVE = 10;
/** [twin-port] 수면 교차 밴드(m): 이 범위를 가로지르는 면(수직 안벽 등)은 수면 교차선을 해안선으로 추가로 찍음 (육지 채움은 그대로) */
export const WATERLINE_BAND = 1.5;
const EXCLUDE = /(crane|WSE_|container|fence|bush|sky|water|^Cube)/i;
// [satfade] 파도 접촉면 = Ground + Plane.002 만 (GLTFLoader 가 "." 제거). EXPORT_GOOGLE_SAT_WM 은 해안 아님
const LAND = /^(Ground|Plane\.?002)$/;
/** 베이크 범위 기준(해상도): 항만 Ground 바운드 + margin. 위성/지형 판(6.4km)이 rect 를 키워 셀이 7m 로 뭉개지던 문제 해결 */
const RECT_REF = /^Ground$/i;

/**
 * [twin-port] busan 지형(Ground/안벽/블록)을 위에서 CPU 래스터화 → 해안 거리장 텍스처.
 * 원본 ocean-tsl bakeShore 와 같은 포맷(RGBA: 높이(수면 기준), 부호거리 m(물 +), 해안방향 xz)
 * 이라서 원본 TSL 해안 거품/스워시 코드가 그대로 동작한다.
 */
export function bakePortShore(root: THREE.Object3D, N = SHORE_N, margin = 400) {
  const t0 = performance.now();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || SKIP.test(m.name) || SKIP.test(m.parent?.name ?? "")) return;
    if (!LAND.test(m.name) && !LAND.test(m.parent?.name ?? "")) return;
    // [twin-port] Ground 노드의 메시 이름은 "Cube002"/"Cube002_1"(glTF mesh 이름) → ^Cube 제외 규칙에 걸려 Ground 전체가 빠졌었음. LAND 직접 매치면 제외 규칙 무시
    if (!LAND.test(m.name) && !LAND.test(m.parent?.name ?? "") && (EXCLUDE.test(m.name) || EXCLUDE.test(m.parent?.name ?? ""))) return;
    meshes.push(m);
    if (RECT_REF.test(m.name) || RECT_REF.test(m.parent?.name ?? "")) box.expandByObject(m);
  });
  if (meshes.length === 0) return null;
  if (box.isEmpty()) for (const m of meshes) box.expandByObject(m);
  const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + margin * 2;
  const minX = (box.min.x + box.max.x) / 2 - size / 2, minZ = (box.min.z + box.max.z) / 2 - size / 2;
  const cell = size / N;
  const level = oceanState.level;
  const h = new Float32Array(N * N).fill(-1000);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry as THREE.BufferGeometry, pos = g.getAttribute("position");
    if (!pos) continue;
    // [twin-port] 위성지형은 바다 위치가 평평한 바닥(≈y 28.5, 수면보다 13m 위)으로 덮여 있음 →
    // 그 바닥면을 육지로 굽으면 Ground 앞바다까지 육지가 되어 Ground 해안 거품이 사라짐. 하위 10% 높이 +1.5m 이하 면은 제외.
    let floorY = -Infinity;
    if (/^EXPORT_GOOGLE/.test(m.name) || /^EXPORT_GOOGLE/.test(m.parent?.name ?? "")) {
      const ys: number[] = [], v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) ys.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).y);
      ys.sort((p, q) => p - q);
      floorY = ys[Math.floor(ys.length * 0.1)]! + 1.5;
    }
    const idx = g.getIndex(), n = idx ? idx.count : pos.count, mw = m.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      // 삼각형 bbox 의 셀 중심마다 barycentric 높이 → 최대값
      const ax = (a.x - minX) / cell - 0.5, az = (a.z - minZ) / cell - 0.5;
      const bx = (b.x - minX) / cell - 0.5, bz = (b.z - minZ) / cell - 0.5;
      const cx = (c.x - minX) / cell - 0.5, cz = (c.z - minZ) / cell - 0.5;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.floor(Math.max(ax, bx, cx)));
      const z0 = Math.max(0, Math.ceil(Math.min(az, bz, cz))), z1 = Math.min(N - 1, Math.floor(Math.max(az, bz, cz)));
      // [twin-port] 수평(위/아래 향) 면만: |normal.y| > 0.7, 높이는 수면 +10m 로 클램프(산지도 육지 마스크 유지) → 크레인/벽 런업 방지
      const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z, e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) continue;
      const yLo = Math.min(a.y, b.y, c.y), yHi = Math.max(a.y, b.y, c.y);
      // [twin-port] 추가 규칙: 수면(y=level)을 가로지르는 면 → 교차 선분을 해안선(육지 가장자리)으로 찍음. 위에서 면적 0 인 수직 안벽 대응
      if (yLo <= level + WATERLINE_BAND && yHi >= level - WATERLINE_BAND && yLo <= level && yHi >= level) {
        const P: [number, number][] = [];
        for (const [p, q] of [[a, b], [b, c], [c, a]] as const)
          if ((p.y - level) * (q.y - level) <= 0 && p.y !== q.y) { const t = (level - p.y) / (q.y - p.y); P.push([p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t]); }
        if (P.length >= 2) {
          const p0 = P[0]!, p1 = P[1]!, steps = Math.max(1, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / (cell * 0.5)));
          for (let s2 = 0; s2 <= steps; s2++) {
            const gx = Math.round((p0[0] + (p1[0] - p0[0]) * s2 / steps - minX) / cell - 0.5), gz = Math.round((p0[1] + (p1[1] - p0[1]) * s2 / steps - minZ) / cell - 0.5);
            if (gx >= 0 && gz >= 0 && gx < N && gz < N) { const k = gz * N + gx; if (h[k]! < 0.5) h[k] = 0.5; }
          }
        }
      }
      if (yHi <= Math.max(floorY, level)) continue; // 육지 채움: 수면 위로 올라온 면의 풋프린트 (위성 바다 바닥 제외)
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-9) continue;
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
          const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const y = Math.min(w0 * a.y + w1 * b.y + w2 * c.y - level, MAX_ABOVE), k = z * N + x;
          if (y > h[k]!) h[k] = y;
        }
    }
  }
  // 미커버 셀 = 바다(깊이 30m 가정)
  for (let i = 0; i < N * N; i++) if (h[i]! <= -999) h[i] = -30;
  const land = new Uint8Array(N * N), water = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { land[i] = h[i]! > 0 ? 1 : 0; water[i] = 1 - land[i]!; }
  const dl = chamfer(land, N), dw = chamfer(water, N);
  const sd = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) sd[i] = (land[i] ? -(dw[i]! - 0.5) : dl[i]! - 0.5) * cell;
  const out = new Float32Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x, xm = Math.max(0, x - 2), xp = Math.min(N - 1, x + 2), ym = Math.max(0, y - 2), yp = Math.min(N - 1, y + 2);
      let gx = sd[y * N + xp]! - sd[y * N + xm]!, gz = sd[yp * N + x]! - sd[ym * N + x]!;
      const l = Math.hypot(gx, gz) || 1;
      gx /= l; gz /= l;
      out[i * 4] = h[i]!; out[i * 4 + 1] = sd[i]!; out[i * 4 + 2] = -gx; out[i * 4 + 3] = -gz;
    }
  setShoreField(out, [minX, minZ, size]);
  console.info(`[OceanTsl] 항구 해안 거리장 베이크 ${N}² cell=${cell.toFixed(1)}m, ${meshes.length} meshes, ${(performance.now() - t0).toFixed(0)}ms`);
  return { rect: [minX, minZ, size] as const, cell };
}

function chamfer(src: Uint8Array, N: number) {
  const d = new Float32Array(N * N), INF = 1e9, D = Math.SQRT2;
  for (let i = 0; i < N * N; i++) d[i] = src[i] ? 0 : INF;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let v = d[i]!;
      if (x > 0) v = Math.min(v, d[i - 1]! + 1);
      if (y > 0) {
        v = Math.min(v, d[i - N]! + 1);
        if (x > 0) v = Math.min(v, d[i - N - 1]! + D);
        if (x < N - 1) v = Math.min(v, d[i - N + 1]! + D);
      }
      d[i] = v;
    }
  for (let y = N - 1; y >= 0; y--)
    for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x;
      let v = d[i]!;
      if (x < N - 1) v = Math.min(v, d[i + 1]! + 1);
      if (y < N - 1) {
        v = Math.min(v, d[i + N]! + 1);
        if (x < N - 1) v = Math.min(v, d[i + N + 1]! + D);
        if (x > 0) v = Math.min(v, d[i + N - 1]! + D);
      }
      d[i] = v;
    }
  return d;
}

/** 베이크 완료 신호 (오션 머티리얼은 RECT 를 컴파일 시 읽으므로 완료 후 마운트) */
import { create } from "zustand";
export const useShoreReady = create<{ ready: boolean; info: string }>(() => ({ ready: false, info: "" }));
export function bakePortShoreOnce(root: THREE.Object3D) {
  if (useShoreReady.getState().ready) return;
  let info = "베이크 실패(해안 거품 없음)";
  try {
    const r = bakePortShore(root);
    if (r) info = `rect ${r.rect.map((v) => v.toFixed(0)).join(",")} cell ${r.cell.toFixed(1)}m`;
  } catch (e) {
    console.warn("[OceanTsl] shore bake failed", e);
  }
  useShoreReady.setState({ ready: true, info });
}
