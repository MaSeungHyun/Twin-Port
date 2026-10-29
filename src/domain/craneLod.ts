import {
  CRANE_LOD_HYSTERESIS,
  CRANE_LOD_LEVELS,
  CRANE_LOD_MIN_TRIANGLES,
} from "@/constants/craneLod";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { MeshoptSimplifier } from "meshoptimizer";
import {
  type BufferGeometry,
  BufferAttribute,
  type Camera,
  type Mesh,
  type Object3D,
  Vector3,
} from "three";

/** 크레인 하위 메시 1개의 LOD 세트. levels[0] = 원본 */
type CraneLodEntry = {
  mesh: Mesh;
  levels: BufferGeometry[];
  current: number;
  center: Vector3;
};

export type CraneLodSet = {
  entries: CraneLodEntry[];
  trianglesPerLevel: number[];
};

export function triangleCount(geometry: BufferGeometry) {
  const index = geometry.getIndex();
  return (index ? index.count : geometry.getAttribute("position").count) / 3;
}

/** 원본 attribute 공유 + 단순화된 index만 새로 만든 geometry */
export function simplifiedGeometry(
  source: BufferGeometry,
  ratio: number,
  error: number,
): BufferGeometry | null {
  const position = source.getAttribute("position");
  if (!position || position.itemSize !== 3 || (position as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) return null;
  const index = source.getIndex();
  const indices = index
    ? Uint32Array.from(index.array as ArrayLike<number>)
    : Uint32Array.from({ length: position.count }, (_, i) => i);
  const positions =
    position.array instanceof Float32Array
      ? position.array
      : Float32Array.from(position.array as ArrayLike<number>);
  const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
  // Prune: 오차 이하의 작은 분리 부품(케이블/난간 등) 제거
  const [out] = MeshoptSimplifier.simplify(indices, positions, 3, target, error, ["Prune"]);
  if (out.length < 3 || out.length >= indices.length) return null;

  const geo = source.clone(); // attribute는 clone이지만 아래에서 원본 공유로 교체
  for (const name of Object.keys(source.attributes)) {
    geo.setAttribute(name, source.getAttribute(name));
  }
  geo.setIndex(new BufferAttribute(out, 1));
  geo.clearGroups();
  geo.boundingBox = source.boundingBox?.clone() ?? null;
  geo.boundingSphere = source.boundingSphere?.clone() ?? null;
  return geo;
}

/** model 안 안벽 크레인 메시를 찾아 LOD geometry 생성 (원본 메시 객체는 그대로 유지) */
export async function buildCraneLods(model: Object3D): Promise<CraneLodSet> {
  await MeshoptSimplifier.ready;
  model.updateMatrixWorld(true);
  const entries: CraneLodEntry[] = [];
  const trianglesPerLevel = new Array(CRANE_LOD_LEVELS.length + 1).fill(0);
  const cache = new Map<BufferGeometry, BufferGeometry[]>();

  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (parseQuayCraneGlbIndex(mesh) == null || /overhead/i.test(mesh.name)) return;
    const base = mesh.geometry;
    const tris = triangleCount(base);
    let levels = cache.get(base);
    if (!levels) {
      levels = [base];
      if (tris >= CRANE_LOD_MIN_TRIANGLES) {
        base.computeBoundingBox();
        base.computeBoundingSphere();
        let prev = base;
        for (const level of CRANE_LOD_LEVELS) {
          prev = simplifiedGeometry(base, level.ratio, level.error) ?? prev;
          levels.push(prev);
        }
      } else {
        for (let i = 0; i < CRANE_LOD_LEVELS.length; i++) levels.push(base);
      }
      cache.set(base, levels);
    }
    levels.forEach((g, i) => (trianglesPerLevel[i] += triangleCount(g)));
    base.computeBoundingSphere();
    const center = base.boundingSphere!.center.clone().applyMatrix4(mesh.matrixWorld);
    entries.push({ mesh, levels, current: 0, center });
  });

  return { entries, trianglesPerLevel };
}

const _cam = new Vector3();

/** 카메라 거리로 각 크레인 메시의 geometry 교체. 바뀐 개수 반환 */
export function updateCraneLods(set: CraneLodSet, camera: Camera, forceLevel: number | null = null) {
  camera.getWorldPosition(_cam);
  let changed = 0;
  for (const entry of set.entries) {
    let level = 0;
    if (forceLevel != null) {
      level = forceLevel;
    } else {
      const d = _cam.distanceTo(entry.center);
      for (let i = 0; i < CRANE_LOD_LEVELS.length; i++) {
        // 현재보다 상세한 쪽으로 돌아올 때는 여유만큼 더 가까워져야 전환
        const edge = CRANE_LOD_LEVELS[i]!.distance * (i + 1 <= entry.current ? 1 - CRANE_LOD_HYSTERESIS : 1);
        if (d >= edge) level = i + 1;
      }
    }
    if (level === entry.current) continue;
    entry.current = level;
    entry.mesh.geometry = entry.levels[level]!;
    changed++;
  }
  return changed;
}

/** 원본 geometry로 복구 (언마운트/선택 시) */
export function resetCraneLods(set: CraneLodSet) {
  for (const entry of set.entries) {
    entry.current = 0;
    entry.mesh.geometry = entry.levels[0]!;
  }
}