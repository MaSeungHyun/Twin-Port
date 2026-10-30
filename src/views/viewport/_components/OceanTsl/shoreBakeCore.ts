/**
 * [worker] 해안 거리장 베이크 순수 CPU 코어 (three 의존 없음) — shoreBake.worker 와 메인 스레드 폴백이 공유.
 * 입력 positions 는 이미 월드 좌표로 변환된 xyz.
 */
export const WATERLINE_BAND = 1.5;
const MAX_ABOVE = 10;

export type ShoreBakeMesh = { pos: Float32Array; idx: Uint32Array | null; google: boolean };
export type ShoreBakeInput = { meshes: ShoreBakeMesh[]; N: number; minX: number; minZ: number; size: number; level: number };

export function bakeShoreCore({ meshes, N, minX, minZ, size, level }: ShoreBakeInput): Float32Array {
  const cell = size / N;
  const h = new Float32Array(N * N).fill(-1000);
  const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }, c = { x: 0, y: 0, z: 0 };
  for (const m of meshes) {
    const pos = m.pos, idx = m.idx;
    // [twin-port] 위성지형은 바다 위치가 평평한 바닥(≈y 28.5, 수면보다 13m 위)으로 덮여 있음 →
    // 그 바닥면을 육지로 굽으면 Ground 앞바다까지 육지가 되어 Ground 해안 거품이 사라짐. 하위 10% 높이 +1.5m 이하 면은 제외.
    let floorY = -Infinity;
    if (m.google) {
      const ys = new Float32Array(pos.length / 3);
      for (let i = 0; i < ys.length; i++) ys[i] = pos[i * 3 + 1]!;
      ys.sort();
      floorY = ys[Math.floor(ys.length * 0.1)]! + 1.5;
    }
    const n = idx ? idx.length : pos.length / 3;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx[i]! : i, i1 = idx ? idx[i + 1]! : i + 1, i2 = idx ? idx[i + 2]! : i + 2;
      a.x = pos[i0 * 3]!; a.y = pos[i0 * 3 + 1]!; a.z = pos[i0 * 3 + 2]!;
      b.x = pos[i1 * 3]!; b.y = pos[i1 * 3 + 1]!; b.z = pos[i1 * 3 + 2]!;
      c.x = pos[i2 * 3]!; c.y = pos[i2 * 3 + 1]!; c.z = pos[i2 * 3 + 2]!;
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
  return out;
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
