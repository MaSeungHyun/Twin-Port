import * as THREE from "three";
import { SHORE_N, setShoreField } from "./scene/resources";
import { oceanState } from "./oceanApi";
import { bakeShoreCore, type ShoreBakeInput, type ShoreBakeMesh } from "./shoreBakeCore";
import { beginSceneWarmTask } from "../Port/WaterReflection";

/** [worker] 워커에서 베이크(전송: typed array transfer). 워커 실패 시 메인 스레드 폴백 */
let shoreWorkerMs = -1;
function runShoreBake(input: ShoreBakeInput): Promise<Float32Array> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    const fallback = () => {
      worker?.terminate();
      console.warn("[OceanTsl] shore bake worker 실패 → 메인 스레드");
      const t = performance.now();
      const out = bakeShoreCore(input);
      shoreWorkerMs = performance.now() - t;
      resolve(out);
    };
    try {
      worker = new Worker(new URL("./shoreBake.worker.ts", import.meta.url), { type: "module" });
    } catch {
      fallback();
      return;
    }
    worker.onmessage = (e: MessageEvent<{ out: Float32Array; ms: number }>) => {
      worker?.terminate();
      shoreWorkerMs = e.data.ms;
      resolve(e.data.out);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      fallback();
    };
    // transfer 하지 않음(구조화 복제 memcpy) → 워커 로드 실패 시에도 원본으로 메인 폴백 가능
    worker.postMessage(input);
  });
}

const SKIP = /^(sky|plane)$|sky|water|ocean/i;
/**
 * 베이크 대상 = 지면형 메시만 (화이트리스트). 크레인(73m)/컨테이너/수목/펜스/위성 도시 메시(EXPORT_GOOGLE_SAT 최대 380m)/Cube 건물은
 * 높이장에 들어가면 해안 스워시가 물 표면을 그 높이까지 끌어올려 "땅 위로 바다가 솟는" 스파이크가 생김.
 */
/** [twin-port] 수면 교차 밴드(m): 이 범위를 가로지르는 면(수직 안벽 등)은 수면 교차선을 해안선으로 추가로 찍음 (육지 채움은 그대로) */
export { WATERLINE_BAND } from "./shoreBakeCore";
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
export async function bakePortShore(root: THREE.Object3D, N = SHORE_N, margin = 400) {
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
  // [worker] 월드 좌표 변환만 메인에서(정점 수 O(n)), 래스터/거리장(chamfer)은 워커
  const data: ShoreBakeMesh[] = [];
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry as THREE.BufferGeometry, pos = g.getAttribute("position");
    if (!pos) continue;
    const wp = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
    }
    const index = g.getIndex();
    data.push({
      pos: wp,
      idx: index ? Uint32Array.from(index.array as ArrayLike<number>) : null,
      google: /^EXPORT_GOOGLE/.test(m.name) || /^EXPORT_GOOGLE/.test(m.parent?.name ?? ""),
    });
  }
  const tPrep = performance.now();
  const out = await runShoreBake({ meshes: data, N, minX, minZ, size, level });
  setShoreField(out, [minX, minZ, size]);
  console.info(`[OceanTsl] 항구 해안 거리장 베이크 ${N}² cell=${cell.toFixed(1)}m, ${meshes.length} meshes, ${(performance.now() - t0).toFixed(0)}ms (메인 준비 ${(tPrep - t0).toFixed(0)}ms, 나머지 워커 — 워커 실제 베이크 ${shoreWorkerMs.toFixed(0)}ms, 나머지는 메인 스레드가 막혀 결과 수신 대기) start@${t0.toFixed(0)} end@${performance.now().toFixed(0)}`);
  return { rect: [minX, minZ, size] as const, cell };
}

/** 베이크 완료 신호 (오션 머티리얼은 RECT 를 컴파일 시 읽으므로 완료 후 마운트) */
import { create } from "zustand";
export const useShoreReady = create<{ ready: boolean; info: string }>(() => ({ ready: false, info: "" }));
let shoreBaking = false;
export function bakePortShoreOnce(root: THREE.Object3D) {
  if (useShoreReady.getState().ready || shoreBaking) return;
  shoreBaking = true;
  // [loader] 베이크가 끝날 때까지 로딩 오버레이 유지 (워커 비동기)
  const finishWarm = beginSceneWarmTask();
  const finish = (info: string) => {
    shoreBaking = false;
    useShoreReady.setState({ ready: true, info });
    finishWarm();
  };
  bakePortShore(root).then(
    (r) => finish(r ? `rect ${r.rect.map((v) => v.toFixed(0)).join(",")} cell ${r.cell.toFixed(1)}m` : "베이크 실패(해안 거품 없음)"),
    (e) => {
      console.warn("[OceanTsl] shore bake failed", e);
      finish("베이크 실패(해안 거품 없음)");
    },
  );
}
