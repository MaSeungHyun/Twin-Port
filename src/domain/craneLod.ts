import { loadSpan } from "@/debug/loadTiming";
import {
  CRANE_LOD_HYSTERESIS,
  CRANE_LOD_LEVELS,
  CRANE_LOD_MIN_TRIANGLES,
} from "@/constants/craneLod";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { simplifyLevels } from "@/domain/meshoptPool";
import { createTimeSlicer } from "@/domain/yieldToMain";
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

/** 단순화 결과 index → 원본 attribute 공유 geometry */
function withIndex(source: BufferGeometry, out: Uint32Array, sourceIndexCount: number): BufferGeometry | null {
  if (out.length < 3 || out.length >= sourceIndexCount) return null;
  const geo = source.clone();
  for (const name of Object.keys(source.attributes)) {
    geo.setAttribute(name, source.getAttribute(name));
  }
  geo.setIndex(new BufferAttribute(out, 1));
  geo.clearGroups();
  geo.boundingBox = source.boundingBox?.clone() ?? null;
  geo.boundingSphere = source.boundingSphere?.clone() ?? null;
  return geo;
}

/** [worker] simplifiedGeometry 의 워커 버전 — 여러 단계를 1회 전송으로 */
export async function simplifiedGeometriesAsync(
  source: BufferGeometry,
  levels: readonly { ratio: number; error: number }[],
): Promise<(BufferGeometry | null)[]> {
  const position = source.getAttribute("position");
  if (!position || position.itemSize !== 3 || (position as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) {
    return levels.map(() => null);
  }
  const index = source.getIndex();
  const indices = index
    ? Uint32Array.from(index.array as ArrayLike<number>)
    : Uint32Array.from({ length: position.count }, (_, i) => i);
  const positions =
    position.array instanceof Float32Array
      ? position.array
      : Float32Array.from(position.array as ArrayLike<number>);
  const outs = await simplifyLevels(
    indices,
    positions,
    levels.map((l) => ({ target: Math.max(3, Math.floor((indices.length * l.ratio) / 3) * 3), error: l.error })),
  );
  return outs.map((o) => withIndex(source, o, indices.length));
}

/** model 안 안벽 크레인 메시를 찾아 LOD geometry 생성 (원본 메시 객체는 그대로 유지). simplify 는 워커 */
/** [load] 계측 래퍼 */
export async function buildCraneLods(model: Object3D): Promise<CraneLodSet> {
  const end = loadSpan("craneLod build");
  try {
    return await buildCraneLodsImpl(model);
  } finally {
    end();
  }
}

async function buildCraneLodsImpl(model: Object3D): Promise<CraneLodSet> {
  model.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  const bases = new Set<BufferGeometry>();
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (mesh as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (parseQuayCraneGlbIndex(mesh) == null || /overhead/i.test(mesh.name)) return;
    meshes.push(mesh);
    bases.add(mesh.geometry);
  });

  const cache = new Map<BufferGeometry, BufferGeometry[]>();
  await Promise.all(
    [...bases].map(async (base) => {
      const levels: BufferGeometry[] = [base];
      if (triangleCount(base) >= CRANE_LOD_MIN_TRIANGLES) {
        base.computeBoundingBox();
        base.computeBoundingSphere();
        const simplified = await simplifiedGeometriesAsync(base, CRANE_LOD_LEVELS);
        let prev = base;
        for (const g of simplified) {
          prev = g ?? prev;
          levels.push(prev);
        }
      } else {
        for (let i = 0; i < CRANE_LOD_LEVELS.length; i++) levels.push(base);
      }
      cache.set(base, levels);
    }),
  );

  const entries: CraneLodEntry[] = [];
  const trianglesPerLevel = new Array(CRANE_LOD_LEVELS.length + 1).fill(0);
  const slice = createTimeSlicer();
  for (const mesh of meshes) {
    const base = mesh.geometry;
    const levels = cache.get(base)!;
    levels.forEach((g, i) => (trianglesPerLevel[i] += triangleCount(g)));
    base.computeBoundingSphere();
    const center = base.boundingSphere!.center.clone().applyMatrix4(mesh.matrixWorld);
    entries.push({ mesh, levels, current: 0, center });
    await slice();
  }

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