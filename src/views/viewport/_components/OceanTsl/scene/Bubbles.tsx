import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { attribute, float, length, mod, sin, smoothstep, uniform, vec3, vec4 } from "three/tsl";
import { useSettings } from "../state/settingsStore";

// [twin-port] 수중 기포: 카메라 주변 박스 볼륨에서 상승·흔들림·재순환하는 빌보드 쿼드.
// 표시/개수/크기/속도 모두 유니폼·drawRange 로만 제어 → 토글 시 재컴파일 없음. WebGL/WebGPU 공통 노드만 사용.
export const BUBBLE_MAX = 1000;
const BOX = 14; // 볼륨 한 변(m)
const U = {
  t: uniform(0),
  on: uniform(0),
  size: uniform(0.05),
  speed: uniform(0.5),
  cam: uniform(new THREE.Vector3()),
  right: uniform(new THREE.Vector3(1, 0, 0)),
  up: uniform(new THREE.Vector3(0, 1, 0)),
};

function makeGeo() {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(BUBBLE_MAX * 4 * 3);
  const crn = new Float32Array(BUBBLE_MAX * 4 * 2);
  const seed = new Float32Array(BUBBLE_MAX * 4 * 4);
  const idx = new Uint32Array(BUBBLE_MAX * 6);
  const C = [-1, -1, 1, -1, 1, 1, -1, 1];
  for (let i = 0; i < BUBBLE_MAX; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      crn[v * 2] = C[k * 2]!;
      crn[v * 2 + 1] = C[k * 2 + 1]!;
      seed.set(s, v * 4);
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("corner", new THREE.BufferAttribute(crn, 2));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function makeMat() {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const corner = attribute<"vec2">("corner", "vec2");
  const seed = attribute<"vec4">("seed", "vec4");
  const sz = U.size.mul(float(0.5).add(seed.w)); // 개별 크기 0.5~1.5배
  const rise = U.t.mul(U.speed).mul(float(0.7).add(seed.w.mul(0.6)));
  const wob = vec3(sin(U.t.mul(2.1).add(seed.x.mul(40.0))), 0.0, sin(U.t.mul(1.7).add(seed.z.mul(40.0)))).mul(0.12);
  const raw = seed.xyz.mul(BOX).add(vec3(0.0, rise, 0.0));
  const local = mod(raw.sub(U.cam), BOX).sub(BOX / 2); // 카메라 기준 [-BOX/2, BOX/2]
  const center = U.cam.add(local).add(wob);
  m.positionNode = center.add(U.right.mul(corner.x.mul(sz))).add(U.up.mul(corner.y.mul(sz)));
  const r = length(corner);
  const disc = smoothstep(1.0, 0.85, r);
  const rim = smoothstep(0.55, 0.95, r).mul(0.75).add(0.12);
  const spec = smoothstep(0.35, 0.0, length(corner.sub(vec3(-0.35, 0.4, 0.0).xy))).mul(0.9);
  const fade = smoothstep(BOX / 2, BOX * 0.15, length(local));
  m.colorNode = vec4(vec3(0.85, 0.95, 1.0), disc.mul(rim.add(spec)).mul(fade).mul(U.on).mul(0.8));
  return m;
}

export function Bubbles({ under }: { under: { value: number } }) {
  const camera = useThree((s) => s.camera);
  const geo = useMemo(makeGeo, []);
  const mat = useMemo(makeMat, []);
  useFrame((_, dt) => {
    const u = useSettings.getState().under;
    U.t.value += Math.min(dt, 0.1);
    U.on.value = u.bubbles && under.value > 0.5 ? 1 : 0;
    U.size.value = u.bubbleSize;
    U.speed.value = u.bubbleSpeed;
    U.cam.value.copy(camera.position);
    const e = camera.matrixWorld.elements;
    U.right.value.set(e[0]!, e[1]!, e[2]!).normalize();
    U.up.value.set(e[4]!, e[5]!, e[6]!).normalize();
    geo.setDrawRange(0, Math.round(Math.min(BUBBLE_MAX, Math.max(0, u.bubbleAmount))) * 6);
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
