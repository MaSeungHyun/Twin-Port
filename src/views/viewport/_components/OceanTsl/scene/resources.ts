import * as THREE from "three";
import { bakeShore } from "../spectrum";

export const ISLAND = new THREE.Vector3(-260, -720, 150);
// 해안 거리장 (한 번만 베이크)
// [twin-port] 섬 대신 항구(busan) 지형에서 런타임 베이크 → setShoreField 로 채움. 초기값 = 전부 깊은 바다
void bakeShore;
export const SHORE_N = 1024;
export const SHORE = {
  data: (() => { const d = new Float32Array(SHORE_N * SHORE_N * 4); for (let i = 0; i < d.length; i += 4) { d[i] = -1000; d[i + 1] = 1000; } return d; })(),
  N: SHORE_N,
  rect: [-1e7, -1e7, 1] as [number, number, number],
};
export const shoreTex = (() => {
  const t = new THREE.DataTexture(
    SHORE.data,
    SHORE.N,
    SHORE.N,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();
/** [twin-port] 해안 거리장 교체 (RGBA: 지형높이(수면 기준), 부호거리(물+), 해안방향 xz). rect 는 셰이더가 첫 컴파일 시 읽으므로 오션 머티리얼 생성 전에 호출 */
export function setShoreField(data: Float32Array, rect: [number, number, number]) {
  SHORE.data.set(data);
  SHORE.rect[0] = rect[0];
  SHORE.rect[1] = rect[1];
  SHORE.rect[2] = rect[2];
  shoreTex.needsUpdate = true;
}


/** busan.glb sky 돔 반지름. 로컬 ±912567m × 노드 스케일 0.01 */
export const OCEAN_RADIUS = 9126;
/** 링 개수는 예전 26km 반경 기준으로 맞춰 둔 밀도. 반경이 줄면 같은 간격이 되도록 링도 줄인다. */
const OCEAN_RING_REFERENCE_RADIUS = 26000;
const OCEAN_SECTORS = 12;

export function radialGrid(rings: number, rMin = 0.3, rMax = OCEAN_RADIUS) {
  const tuned = Math.max(48, Math.round(rings * Math.log(rMax / rMin) / Math.log(OCEAN_RING_REFERENCE_RADIUS / rMin)));
  const g = Math.log(rMax / rMin) / tuned,
    seg = Math.max(64, Math.round((2 * Math.PI) / g));
  const pos = new Float32Array((1 + (tuned + 1) * seg) * 3),
    idx: number[] = [];
  let o = 3;
  for (let j = 0; j <= tuned; j++) {
    const rr = rMin * Math.exp(j * g);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2 + (j % 2) * (Math.PI / seg);
      pos[o++] = Math.cos(a) * rr;
      pos[o++] = 0;
      pos[o++] = Math.sin(a) * rr;
    }
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let j = 0; j < tuned; j++)
    for (let i = 0; i < seg; i++) {
      const a = 1 + j * seg + i,
        b = 1 + j * seg + ((i + 1) % seg),
        c = 1 + (j + 1) * seg + i,
        d = 1 + (j + 1) * seg + ((i + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  const geos = splitOceanSectors(pos, idx, OCEAN_SECTORS);
  if (import.meta.env.DEV) {
    const tris = geos.map((geo) => (geo.getIndex()?.count ?? 0) / 3);
    console.info(`[ocean] radius ${rMax}m, ${geos.length} sectors, tris`, tris.map(Math.round));
  }
  return { geos, g };
}

/** 부채꼴로 나눠 카메라 밖 조각은 프러스텀 컬링으로 정점 계산을 건너뛴다. */
function splitOceanSectors(pos: Float32Array, idx: number[], sectors: number) {
  const span = (Math.PI * 2) / sectors;
  const buckets: number[][] = Array.from({ length: sectors }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const ia = idx[t]!, ib = idx[t + 1]!, ic = idx[t + 2]!;
    let x = 0, z = 0, w = -1;
    for (const v of [ia, ib, ic]) {
      const px = pos[v * 3]!, pz = pos[v * 3 + 2]!;
      const d = px * px + pz * pz;
      if (d > w) { w = d; x = px; z = pz; }
    }
    let a = Math.atan2(z, x);
    if (a < 0) a += Math.PI * 2;
    buckets[Math.min(sectors - 1, Math.floor(a / span))]!.push(ia, ib, ic);
  }
  return buckets.filter((list) => list.length >= 3).map((list) => {
    const map = new Map<number, number>();
    const index: number[] = [];
    const out: number[] = [];
    for (const v of list) {
      let n = map.get(v);
      if (n == null) {
        n = map.size;
        map.set(v, n);
        out.push(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!);
      }
      index.push(n);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    geo.setIndex(index);
    geo.computeBoundingSphere();
    return geo;
  });
}

export const skyU = () => ({
  uTime: { value: 0 },
  uSun: { value: new THREE.Vector3() },
  uSunColor: { value: new THREE.Color() },
  uSunI: { value: 1 },
  uZenith: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uClouds: { value: 0 },
  uCam: { value: new THREE.Vector3() },
  uUnderG: { value: 0 },
  uSplit: { value: 0 },
  uWL: { value: null as THREE.Texture | null },
  uRes: { value: new THREE.Vector2(1, 1) },
  uCamF: { value: new THREE.Vector3() },
  uNear: { value: 0.3 },
  uUWCol: { value: new THREE.Color() },
  uUWDens: { value: 0.09 },
  uCamDepth: { value: 0 },
});

export const STRIP = 256; // 근평면 가로 스트립 해상도 (픽셀 단위 수면 분할용)
export const MAX_PTS = 64,
  PER_CUBE = 6,
  MAX_CUBES = 10; // 큐브당 샘플: 기준점(수평 변위), 중심, 모서리 4
// WebGPURenderer 공용 RenderTarget (WebGLRenderTarget → RenderTarget)
export const probeRT = new THREE.RenderTarget(STRIP, 2, {
  type: THREE.FloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: false,
});
const probeTri = new THREE.BufferGeometry();
probeTri.setAttribute(
  "position",
  new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
);

export interface Cube {
  mesh: THREE.Mesh;
  anchor: THREE.Vector2;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  rv: THREE.Vector3;
  yawV: number;
  h: number[];
  drift: THREE.Vector2;
  ok: boolean;
}

// [twin-port TSL 통일] GLSL ShaderMaterial 경로(makeOceanMat/makeSkyMat/makeIslandMat/makeProbe/makeSeabed) 제거.
// 머티리얼은 webgpu/oceanTSL.ts 의 *GPU (TSL 노드) 만 사용 → WebGPU / WebGL2 백엔드 공통.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UniformMat = THREE.Material & { uniforms: Record<string, { value: any }> };
export interface Probe {
  m: UniformMat;
  scene: THREE.Scene;
  cam: THREE.Camera;
  k: number;
  busy: boolean;
  h: number;
  under: boolean;
  blend: number;
}
export interface Seabed {
  g: THREE.BufferGeometry;
  m: UniformMat;
}
export { probeTri };
