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


export function radialGrid(rings: number, rMin = 0.3, rMax = 26000) {
  const g = Math.log(rMax / rMin) / rings,
    seg = Math.max(64, Math.round((2 * Math.PI) / g));
  const pos = new Float32Array((1 + (rings + 1) * seg) * 3),
    idx: number[] = [];
  let o = 3;
  for (let j = 0; j <= rings; j++) {
    const rr = rMin * Math.exp(j * g);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2 + (j % 2) * (Math.PI / seg);
      pos[o++] = Math.cos(a) * rr;
      pos[o++] = 0;
      pos[o++] = Math.sin(a) * rr;
    }
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < seg; i++) {
      const a = 1 + j * seg + i,
        b = 1 + j * seg + ((i + 1) % seg),
        c = 1 + (j + 1) * seg + i,
        d = 1 + (j + 1) * seg + ((i + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return { geo, g };
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
