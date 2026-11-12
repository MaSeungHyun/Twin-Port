import { AREA_FADE_WHOLE_SPAN } from "@/constants/areaCam";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  type Material,
  type Object3D,
} from "three";

/**
 * 영역 페이드가 위치와 상관없이 같이 움직이는 고정 구조물만 재질·속성 구성별로 합친다.
 * 구역 안/밖에서 따로 흐려지는 건물, 크레인·선박·컨테이너, LOD 청크는 그대로 둔다.
 * (areaDepthFade 의 veg / wse / 통째 페이드 / 위성과 같은 구분)
 */
const VEGETATION_RE = /^(bush|tree|veg|plant|grass)/i;
const WSE_RE = /wse/i;
const SAT_RE = /^EXPORT_GOOGLE_SAT_WM\.?001$/;
/** 모델에서 이름으로 위치를 읽는 오브젝트 (extractGroundBlocks: 블록·LimitLine, extractShipCubes: 선박 포인트). 합치면 이름과 위치를 잃는다. */
const EXTRACTED_RE = /block|limitline|^b\d{1,2}(\.\d+)?$|^ship/i;
const TOUCH_M = 0.5;

type FadeClass = "sat" | "veg" | "wse" | "whole" | "placed";

type Item = {
  mesh: Mesh;
  material: Material;
  attrs: string;
  fade: FadeClass;
  box: Box3;
};

const _box = new Box3();
const _inv = new Matrix4();
const _local = new Matrix4();

function attrKey(geometry: BufferGeometry) {
  return Object.keys(geometry.attributes).sort().join(",");
}

/**
 * meshopt 양자화 속성(Int16/Uint16·normalized 등)과 Float32 가 한 묶음에 섞이면 mergeGeometries 가 uv 등에서 실패한다.
 * 정수 배열에 applyMatrix4 를 하면 소수가 잘리기도 하므로, 합칠 복제본은 먼저 Float32 로 푼다. (원본 GLB 지오메트리는 그대로)
 */
function toFloat32Attributes(geometry: BufferGeometry) {
  for (const name of Object.keys(geometry.attributes)) {
    const a = geometry.getAttribute(name);
    const interleaved = "isInterleavedBufferAttribute" in a && a.isInterleavedBufferAttribute === true;
    if (!interleaved && a.array instanceof Float32Array && !a.normalized) continue;
    const n = a.count;
    const s = a.itemSize;
    const out = new Float32Array(n * s);
    for (let i = 0; i < n; i++) {
      out[i * s] = a.getX(i);
      if (s > 1) out[i * s + 1] = a.getY(i);
      if (s > 2) out[i * s + 2] = a.getZ(i);
      if (s > 3) out[i * s + 3] = a.getW(i);
    }
    geometry.setAttribute(name, new BufferAttribute(out, s));
  }
}

function fadeClass(mesh: Mesh): FadeClass | null {
  if ((mesh as { isInstancedMesh?: boolean }).isInstancedMesh) return null;
  if (mesh.userData.groundLod || mesh.userData.quayDraw || mesh.userData.quaySource) return null;
  if (parseQuayCraneGlbIndex(mesh) != null) return null;
  if (mesh.children.length > 0) return null;
  if (Array.isArray(mesh.material)) return null;
  if (mesh.geometry.groups.length > 1) return null;
  if ([mesh.name, mesh.parent?.name ?? "", mesh.geometry.name ?? ""].some((n) => n && EXTRACTED_RE.test(n))) return null;
  // busan "Plane" = 기존 평면 수면(12.7km, y≈15.3). OceanTsl 이 이름으로 찾아 숨기므로 합치면 안 된다
  // (Cube 와 합쳐지면 이름을 잃어 숨김이 안 되고, 바다 위에 평평한 수면이 덮여 바다가 내려간 것처럼 보였다)
  if (mesh.name === "Plane" || mesh.parent?.name === "Plane") return null;
  const named = [mesh.name, mesh.parent?.name ?? ""];
  if (named.some((n) => SAT_RE.test(n))) return "sat";
  if (named.some((n) => VEGETATION_RE.test(n))) return "veg";
  let node: Object3D | null = mesh;
  while (node) {
    if (WSE_RE.test(node.name)) return "wse";
    node = node.parent;
  }
  if (!_box.setFromObject(mesh).isEmpty()) {
    const span = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z);
    if (span >= AREA_FADE_WHOLE_SPAN) return "whole";
  }
  return "placed";
}

function touches(a: Box3, b: Box3) {
  return (
    a.min.x - TOUCH_M <= b.max.x &&
    b.min.x - TOUCH_M <= a.max.x &&
    a.min.y - TOUCH_M <= b.max.y &&
    b.min.y - TOUCH_M <= a.max.y &&
    a.min.z - TOUCH_M <= b.max.z &&
    b.min.z - TOUCH_M <= a.max.z
  );
}

/** 붙어 있는 조각만 한 덩어리로. 멀리 떨어진 건물은 영역 페이드 중심이 달라진다. */
function clustersOf(items: Item[], joinAll: boolean) {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!joinAll && !touches(items[i]!.box, items[j]!.box)) continue;
      const a = find(i);
      const b = find(j);
      if (a !== b) parent[b] = a;
    }
  }
  const groups = new Map<number, Item[]>();
  items.forEach((item, i) => {
    const id = find(i);
    const list = groups.get(id);
    if (list) list.push(item);
    else groups.set(id, [item]);
  });
  return [...groups.values()].filter((list) => list.length >= 2);
}

export function mergeFadeIdenticalStatic(root: Object3D) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map<string, Item[]>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const fade = fadeClass(o);
    if (!fade) return;
    const material = o.material as Material;
    const key = `${fade}|${material.uuid}|${attrKey(o.geometry)}|${o.geometry.index ? "i" : "n"}`;
    const box = new Box3().setFromObject(o);
    if (box.isEmpty()) return;
    const item = { mesh: o, material, attrs: attrKey(o.geometry), fade, box };
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  });

  let removed = 0;
  let created = 0;
  for (const [key, items] of buckets) {
    if (items.length < 2) continue;
    const joinAll = key.startsWith("sat|") || key.startsWith("veg|") || key.startsWith("wse|") || key.startsWith("whole|");
    const clusters = joinAll ? [items] : clustersOf(items, false);
    for (const cluster of clusters) {
      const geometries: BufferGeometry[] = [];
      for (const item of cluster) {
        const geometry = item.mesh.geometry.clone();
        _local.copy(item.mesh.matrixWorld).premultiply(_inv);
        toFloat32Attributes(geometry);
        geometry.applyMatrix4(_local);
        geometries.push(geometry);
      }
      const merged = mergeGeometries(geometries, false);
      for (const geometry of geometries) geometry.dispose();
      if (!merged) continue;
      const first = cluster[0]!.mesh;
      const mesh = new Mesh(merged, cluster[0]!.material);
      mesh.name = first.name;
      mesh.castShadow = cluster.some((item) => item.mesh.castShadow);
      mesh.receiveShadow = cluster.some((item) => item.mesh.receiveShadow);
      mesh.renderOrder = Math.min(...cluster.map((item) => item.mesh.renderOrder));
      mesh.frustumCulled = true;
      if (cluster.every((item) => item.mesh.userData.noWireframe)) mesh.userData.noWireframe = true;
      root.add(mesh);
      for (const item of cluster) item.mesh.removeFromParent();
      removed += cluster.length;
      created += 1;
    }
  }
  if (removed > 0) {
    console.info(`[merge] 고정 구조물 ${removed}개 → ${created}개`);
  }
}
