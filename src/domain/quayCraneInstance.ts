/**
 * [quay] 안벽 크레인은 같은 부품 geometry 를 크레인마다 Mesh 로 그린다.
 * 2개 이상 겹치는 부품은 InstancedMesh 하나로 묶고, 거리 LOD 와 구역 페이드는
 * 인스턴스를 단계별 메시에 나눠 담는다. 원본 Mesh 는 숨겨 호버 외곽선·추적·반사의 기준으로 남긴다.
 */
import { DEPTH_FADE_DURATION_S, DEPTH_UNFOCUSED_OPACITY } from "@/constants/areaCam";
import { CRANE_LOD_HYSTERESIS, CRANE_LOD_LEVELS } from "@/constants/craneLod";
import { simplifiedGeometriesAsync } from "@/domain/craneLod";
import { attachCraneFade, writeFadeOpacity } from "@/domain/fadeOpacity";
import { findQuayCraneRoot } from "@/domain/hoverOutline";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Material,
  type Object3D,
} from "three";

type Member = { glbIndex: number; matrix: Matrix4 };

type PartGroup = {
  geometry: BufferGeometry;
  material: Material | Material[];
  fadedMaterial: Material | Material[];
  shadow: InstancedMesh;
  members: Member[];
  /** [solid|dim][lod]. lod 0 은 동기, 이후 단계는 단순화 후 채운다. */
  slots: (InstancedMesh | null)[][];
};

const LOD_COUNT = CRANE_LOD_LEVELS.length + 1;

let buildToken = 0;
let modelRoot: Object3D | null = null;
let groups: PartGroup[] = [];
let hoverIdByGlb = new Map<number, string>();
let localCenter = new Map<number, Vector3>();
let levelByGlb = new Map<number, number>();
let focus: ReadonlySet<number> | null = null;
let dimmed = new Set<number>();
let returning = false;
let dimOpacity = 1;

const _cam = new Vector3();
const _world = new Vector3();
const _inv = new Matrix4();

function materialKey(material: Material | Material[]) {
  const list = Array.isArray(material) ? material : [material];
  return list.map((m) => m.uuid).join(",");
}

/** 비포커스 슬롯만 전용 알파 재질 사용. 모든 LOD가 같은 opacity uniform을 공유한다. */
function makeFadeMaterial(material: Material | Material[]) {
  const clone = (source: Material) => {
    const faded = source.clone();
    faded.customProgramCacheKey = () => `${source.customProgramCacheKey()}|quay-instance-fade`;
    // 부품이 겹치면 opacity만으로는 다시 진해진다. 알베도도 같이 0.1까지 낮춘다.
    return attachCraneFade(faded);
  };
  return Array.isArray(material) ? material.map(clone) : clone(material);
}

function paintDim(value: number) {
  for (const group of groups) {
    writeFadeOpacity(group.fadedMaterial, value);
  }
}

/** StrictMode 가 빌드를 두 번 돌려도 이전 인스턴스가 불투명으로 겹쳐 남지 않게 걷어낸다. */
function dropQuayDraw(root: Object3D) {
  const stale: InstancedMesh[] = [];
  const fadedMaterials = new Set<Material>();
  root.traverse((child) => {
    const mesh = child as InstancedMesh;
    if (mesh.isInstancedMesh && mesh.userData.quayDraw) stale.push(mesh);
  });
  for (const mesh of stale) {
    if (mesh.userData.quayFade) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) fadedMaterials.add(material);
    }
    mesh.parent?.remove(mesh);
    mesh.instanceMatrix.dispose();
    mesh.dispose();
  }
  for (const material of fadedMaterials) material.dispose();
}

function makeMesh(geometry: BufferGeometry, material: Material | Material[], capacity: number, dim: boolean) {
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = "crane-instanced";
  mesh.userData.quayDraw = true;
  mesh.userData.quayFade = dim;
  mesh.userData.glbIndices = [] as number[];
  mesh.count = 0;
  mesh.visible = false;
  // 그림자는 카메라 LOD와 무관한 고정 프록시에서 그린다.
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  modelRoot!.add(mesh);
  return mesh;
}

function makeShadow(geometry: BufferGeometry, material: Material | Material[], members: Member[]) {
  const mesh = makeMesh(geometry, material, members.length, false);
  mesh.name = "crane-shadow";
  mesh.userData.quayShadow = true;
  mesh.layers.set(1); // SunLight의 그림자 카메라만 포함 (선박 그림자와 동일).
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.raycast = () => undefined;
  mesh.count = members.length;
  mesh.visible = true;
  members.forEach((member, i) => mesh.setMatrixAt(i, member.matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function wantDim(glbIndex: number) {
  return focus != null && !focus.has(glbIndex);
}

function place() {
  const next = new Set<number>();
  for (const id of localCenter.keys()) {
    if (wantDim(id) || (returning && dimmed.has(id))) next.add(id);
  }
  dimmed = next;
  for (const group of groups) {
    const bins = new Map<InstancedMesh, Member[]>();
    for (const row of group.slots) {
      for (const mesh of row) if (mesh) bins.set(mesh, []);
    }
    for (const member of group.members) {
      const dim = dimmed.has(member.glbIndex) ? 1 : 0;
      let lod = levelByGlb.get(member.glbIndex) ?? 0;
      while (lod > 0 && !group.slots[dim]![lod]) lod -= 1;
      const mesh = group.slots[dim]![lod];
      if (!mesh) continue;
      bins.get(mesh)!.push(member);
    }
    for (const [mesh, list] of bins) {
      // LOD가 바뀌지 않은 슬롯까지 다시 업로드하지 않는다.
      const previous = mesh.userData.quayMembers as Member[] | undefined;
      if (previous?.length === list.length && list.every((member, i) => member === previous[i])) continue;
      mesh.userData.quayMembers = list;
      mesh.count = list.length;
      mesh.visible = list.length > 0;
      for (let i = 0; i < list.length; i += 1) mesh.setMatrixAt(i, list[i]!.matrix);
      if (list.length > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        // 버킷의 구성원이 바뀌면 culling/raycast 경계도 새 행렬에 맞춘다.
        mesh.computeBoundingSphere();
      }
      mesh.userData.glbIndices = list.map((member) => member.glbIndex);
    }
  }
  paintDim(dimOpacity);
}

function resetGroups() {
  groups = [];
  hoverIdByGlb = new Map();
  localCenter = new Map();
  levelByGlb = new Map();
  dimmed = new Set();
  returning = false;
  dimOpacity = 1;
  modelRoot = null;
}

/** 같은 geometry 를 쓰는 안벽 크레인 부품을 InstancedMesh 로 바꾼다. LOD 메시까지 붙으면 resolve. */
export function instanceQuayCranes(root: Object3D): Promise<void> {
  const token = ++buildToken;
  dropQuayDraw(root);
  resetGroups();
  modelRoot = root;
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();

  const buckets = new Map<string, { geometry: BufferGeometry; material: Material | Material[]; members: Member[] }>();
  let hidden = 0;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.userData.quayDraw) return;
    if ((mesh as InstancedMesh).isInstancedMesh) return;
    const glbIndex = parseQuayCraneGlbIndex(mesh);
    if (glbIndex == null || /overhead/i.test(mesh.name)) return;
    const key = `${mesh.geometry.uuid}|${materialKey(mesh.material)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { geometry: mesh.geometry, material: mesh.material, members: [] };
      buckets.set(key, bucket);
    }
    const matrix = new Matrix4().multiplyMatrices(_inv, mesh.matrixWorld);
    bucket.members.push({ glbIndex, matrix });
  });

  const sum = new Map<number, { x: number; y: number; z: number; n: number }>();
  for (const bucket of buckets.values()) {
    if (bucket.members.length < 2) continue;
    const group: PartGroup = {
      geometry: bucket.geometry,
      material: bucket.material,
      fadedMaterial: makeFadeMaterial(bucket.material),
      shadow: makeShadow(bucket.geometry, bucket.material, bucket.members),
      members: bucket.members,
      slots: [Array(LOD_COUNT).fill(null), Array(LOD_COUNT).fill(null)],
    };
    group.slots[0]![0] = makeMesh(bucket.geometry, bucket.material, bucket.members.length, false);
    group.slots[1]![0] = makeMesh(bucket.geometry, group.fadedMaterial, bucket.members.length, true);
    groups.push(group);
    for (const member of bucket.members) {
      const pos = new Vector3().setFromMatrixPosition(member.matrix);
      const acc = sum.get(member.glbIndex) ?? { x: 0, y: 0, z: 0, n: 0 };
      acc.x += pos.x;
      acc.y += pos.y;
      acc.z += pos.z;
      acc.n += 1;
      sum.set(member.glbIndex, acc);
      levelByGlb.set(member.glbIndex, 0);
    }
  }

  // 호버 id 는 숨기기 전에 원본 크레인 루트 uuid 로 잡는다.
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.userData.quayDraw) return;
    const glbIndex = parseQuayCraneGlbIndex(mesh);
    if (glbIndex == null || hoverIdByGlb.has(glbIndex)) return;
    const crane = findQuayCraneRoot(mesh);
    if (crane) hoverIdByGlb.set(glbIndex, crane.uuid);
  });

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.userData.quayDraw) return;
    if ((mesh as InstancedMesh).isInstancedMesh) return;
    const glbIndex = parseQuayCraneGlbIndex(mesh);
    if (glbIndex == null) return;
    const key = `${mesh.geometry.uuid}|${materialKey(mesh.material)}`;
    if ((buckets.get(key)?.members.length ?? 0) < 2) return;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.raycast = () => undefined;
    mesh.userData.quaySource = true;
    hidden += 1;
  });

  for (const [id, acc] of sum) {
    localCenter.set(id, new Vector3(acc.x / acc.n, acc.y / acc.n, acc.z / acc.n));
  }
  place();

  if (import.meta.env.DEV) {
    console.info(
      `[quayInstance] ${hidden} meshes → ${groups.length} instanced parts, cranes ${localCenter.size}`,
    );
  }
  if (!groups.length) return Promise.resolve();

  const tokenAtBuild = token;
  const built = groups;
  return Promise.all(built.map((group) => simplifiedGeometriesAsync(group.geometry, CRANE_LOD_LEVELS)))
    .then((outs) => {
      if (tokenAtBuild !== buildToken) return;
      outs.forEach((levels, index) => {
        const group = built[index];
        if (!group) return;
        let prev = group.geometry;
        levels.forEach((geo, level) => {
          const next = geo ?? prev;
          prev = next;
          if (next === group.geometry) return;
          group.slots[0]![level + 1] = makeMesh(next, group.material, group.members.length, false);
          group.slots[1]![level + 1] = makeMesh(next, group.fadedMaterial, group.members.length, true);
        });
        // 카메라 이동 중 새 LOD 그림자 셰이더를 만들거나 고해상도 부품을 다시 그리지 않는다.
        group.shadow.geometry = prev;
        group.shadow.computeBoundingSphere();
      });
      place();
      paintDim(dimOpacity);
    })
    .catch((error) => {
      console.warn("[quayInstance] LOD 생성 실패, 원본 인스턴스 유지", error);
    })
    .then(() => undefined);
}

/** 월드 점에서 가장 가까운 안벽 크레인. 인스턴스 id 가 없을 때의 호버 폴백 */
export function quayGlbIndexNear(point: Vector3, maxDist = 45) {
  if (!modelRoot) return null;
  let best: number | null = null;
  let bestD = maxDist;
  for (const [id, center] of localCenter) {
    _world.copy(center).applyMatrix4(modelRoot.matrixWorld);
    const d = _world.distanceTo(point);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function quayHoverId(glbIndex: number) {
  return hoverIdByGlb.get(glbIndex) ?? null;
}

/** 클릭/호버된 인스턴스 → 원래 크레인 루트 uuid 와 GLB index */
export function quayDrawPointer(object: Object3D, instanceId: number | undefined | null) {
  if (instanceId == null) return null;
  const indices = (object.userData as { glbIndices?: number[] }).glbIndices;
  if (!indices) return null;
  const glbIndex = indices[instanceId];
  if (glbIndex == null) return null;
  const id = hoverIdByGlb.get(glbIndex);
  if (!id) return null;
  return { id, glbIndex };
}

/** 구역 Depth 포커스. null 이면 전부 불투명. */
export function setQuayInstanceFocus(next: ReadonlySet<number> | null) {
  focus = next;
  const keys = [...localCenter.keys()];
  const wantAny = next != null && keys.some((id) => !next.has(id));
  if (wantAny) {
    returning = false;
    dimOpacity = DEPTH_UNFOCUSED_OPACITY;
    paintDim(dimOpacity);
  } else if (dimmed.size > 0) returning = true;
  place();
}

/** 카메라가 움직였을 때 크레인 거리로 LOD 버킷을 다시 나눈다. */
export function updateQuayCraneLods(camera: Camera) {
  if (!groups.length || !modelRoot) return;
  camera.getWorldPosition(_cam);
  let changed = false;
  for (const [id, center] of localCenter) {
    _world.copy(center).applyMatrix4(modelRoot.matrixWorld);
    const current = levelByGlb.get(id) ?? 0;
    let level = 0;
    const distance = _cam.distanceTo(_world);
    for (let i = 0; i < CRANE_LOD_LEVELS.length; i += 1) {
      const edge = CRANE_LOD_LEVELS[i]!.distance * (i + 1 <= current ? 1 - CRANE_LOD_HYSTERESIS : 1);
      if (distance >= edge) level = i + 1;
    }
    if (level !== current) {
      levelByGlb.set(id, level);
      changed = true;
    }
  }
  if (changed) place();
}

/** 포커스 밖 크레인 인스턴스의 공용 페이드 opacity. */
export function updateQuayCraneFade(dt: number) {
  if (!groups.length) return;
  const wantAny = focus != null && [...localCenter.keys()].some((id) => !focus!.has(id));
  const goal = wantAny ? DEPTH_UNFOCUSED_OPACITY : 1;
  const step = DEPTH_FADE_DURATION_S > 0 ? (dt * (1 - DEPTH_UNFOCUSED_OPACITY)) / DEPTH_FADE_DURATION_S : 1;
  if (dimOpacity !== goal) {
    const delta = goal - dimOpacity;
    dimOpacity = Math.abs(delta) <= step ? goal : dimOpacity + Math.sign(delta) * step;
  }
  paintDim(dimOpacity);
  if (returning && dimOpacity >= 1) {
    returning = false;
    dimmed.clear();
    place();
  }
}
