/**
 * [areafade] 구역/그룹 Depth 진입 시 포커스 밖 오브젝트(지면·Plane002·수목·건물·다른 구역 야드 크레인/컨테이너)를 반투명으로.
 * 레벨: 0 = 포커스(불투명), 1 = 구역 밖(구역 Depth 진입 시 페이드), 2 = 구역 안이지만 그룹 Depth 에서 포커스 밖(그룹 진입 시 페이드).
 * 원본 머티리얼마다 레벨 1/2 용 transparent 복제를 1회 만들어 공유 → 런타임엔 material 참조/인스턴스 라우팅 + opacity(uniform) 트윈만 (재컴파일 없음).
 * 안벽 크레인은 craneDepthFade.ts (크레인별 개별 페이드), 선박/선적 컨테이너는 대상 아님(항상 표시).
 */
import {
  AREA_C_BLOCK_NAME_PATTERN,
  AREA_C_BLOCK_NAME_RANGE,
  AREA_CRANE_RANGES,
  AREA_FADE_BOUNDS_MARGIN,
  AREA_FADE_WHOLE_SPAN,
  DEPTH_FADE_DURATION_S,
  DEPTH_UNFOCUSED_OPACITY,
} from "@/constants/areaCam";
import type { BlockDefinition } from "@/constants/block";
import { getBlockFootprintSize } from "@/domain/blockFootprint";
import { getCraneFocusTarget } from "@/domain/cameraFocus";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { useYardStore } from "@/stores/yard";
import { useSyncExternalStore } from "react";
import { Box3, Material, Mesh, Vector3, type Object3D } from "three";

export type FadeLevel = 0 | 1 | 2;
type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
type StaticEntry = { mesh: Mesh; original: Material | Material[]; cx: number; cz: number; whole: boolean; veg: boolean };

const SAT_RE = /^EXPORT_GOOGLE_SAT_WM\.?001$/;
/** [areafade] 덤불(bush, bush.001, bush.002: 야드 사이 장식) — 중심점이 구역 사각형 안에 걸려 남던 문제 → 구역 Depth 에서 항상 페이드 */
const VEGETATION_RE = /^(bush|tree|veg|plant|grass)/i;

/** 레벨 1/2 페이드 진행도(0..1)와 목표 (index 0 미사용) */
const progress = [0, 0, 0];
const target = [0, 0, 0];
/** 원하는 포커스(UI) / 실제 적용 포커스 ? 나갈 때는 페이드 아웃이 끝날 때까지 이전 레벨 유지 */
let desired: { area: string; group: boolean } | null = null;
let areaKey: string | null = null;
let groupOn = false;
let areaBlocks = new Set<string>();
let areaRect: Rect | null = null;

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  for (const l of listeners) l();
};

/** 원본 → [레벨1 복제, 레벨2 복제] */
const clones = new Map<Material, [Material, Material]>();
const baseOpacity = new Map<Material, number>();
let statics: StaticEntry[] = [];
const staticByMesh = new Map<Mesh, StaticEntry>();

function opacityOf(level: 1 | 2) {
  return 1 - (1 - DEPTH_UNFOCUSED_OPACITY) * progress[level]!;
}

function makeClone(m: Material, level: 1 | 2) {
  const c = m.clone();
  c.name = `${m.name}-areafade${level}`;
  c.transparent = true;
  if (!m.transparent) c.depthWrite = true; // 불투명 원본은 깊이 유지 (자기 가림·바다 가림 유지)
  baseOpacity.set(c, m.opacity);
  c.opacity = m.opacity * opacityOf(level);
  c.needsUpdate = true;
  return c;
}

export function getFadeMaterial(m: Material, level: 1 | 2): Material {
  let pair = clones.get(m);
  if (!pair) {
    pair = [makeClone(m, 1), makeClone(m, 2)];
    clones.set(m, pair);
  }
  return pair[level - 1];
}
export function getFadeMaterials(m: Material | Material[], level: 1 | 2): Material | Material[] {
  return Array.isArray(m) ? m.map((x) => getFadeMaterial(x, level)) : getFadeMaterial(m, level);
}

function blockCorners(b: BlockDefinition, off: readonly number[]) {
  const { width, depth } = getBlockFootprintSize(b);
  const c = Math.cos(b.yaw ?? 0);
  const s = Math.sin(b.yaw ?? 0);
  return ([[0, 0], [width, 0], [width, depth], [0, depth]] as const).map(
    ([lx, lz]) => [b.origin[0] + lx * c + lz * s + (off[0] ?? 0), b.origin[2] - lx * s + lz * c + (off[2] ?? 0)] as const,
  );
}

/** 블록 → 구역: C 는 버튼과 같은 GLB 이름(Block040~045), 나머지는 가장 가까운 안벽 크레인(C 제외)의 구역.
 *  구역 영역 = 그 구역 블록 footprint + 구역 크레인 위치의 XZ 경계 + 여유 */
function computeArea(key: string) {
  const { blocks, yardOffset } = useYardStore.getState();
  const cranes: { area: string; x: number; z: number }[] = [];
  for (const [area, [a, b]] of Object.entries(AREA_CRANE_RANGES)) {
    for (let i = a; i <= b; i++) {
      const v = getCraneFocusTarget(i);
      if (v) cranes.push({ area, x: v.x, z: v.z });
    }
  }
  const members = new Set<string>();
  const rect: Rect = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const grow = (x: number, z: number) => {
    rect.minX = Math.min(rect.minX, x);
    rect.maxX = Math.max(rect.maxX, x);
    rect.minZ = Math.min(rect.minZ, z);
    rect.maxZ = Math.max(rect.maxZ, z);
  };
  for (const b of blocks) {
    const corners = blockCorners(b, yardOffset);
    let area: string | null = null;
    const m = AREA_C_BLOCK_NAME_PATTERN.exec(b.name);
    const n = m ? Number(m[1]) : NaN;
    if (n >= AREA_C_BLOCK_NAME_RANGE[0] && n <= AREA_C_BLOCK_NAME_RANGE[1]) area = "C";
    else {
      const cx = corners.reduce((a, p) => a + p[0], 0) / 4;
      const cz = corners.reduce((a, p) => a + p[1], 0) / 4;
      let best = Infinity;
      for (const c of cranes) {
        if (c.area === "C") continue; // C 블록은 이름으로만 지정
        const d = Math.hypot(c.x - cx, c.z - cz);
        if (d < best) {
          best = d;
          area = c.area;
        }
      }
    }
    if (area !== key) continue;
    members.add(b.code);
    for (const [x, z] of corners) grow(x, z);
  }
  for (const c of cranes) if (c.area === key) grow(c.x, c.z);
  if (!Number.isFinite(rect.minX)) return { members, rect: null };
  rect.minX -= AREA_FADE_BOUNDS_MARGIN;
  rect.maxX += AREA_FADE_BOUNDS_MARGIN;
  rect.minZ -= AREA_FADE_BOUNDS_MARGIN;
  rect.maxZ += AREA_FADE_BOUNDS_MARGIN;
  if (import.meta.env.DEV) console.info(`[areafade] ${key}구역 블록 ${[...members].join(", ") || "없음"}`, rect);
  return { members, rect };
}

const inside = (x: number, z: number) =>
  !!areaRect && x >= areaRect.minX && x <= areaRect.maxX && z >= areaRect.minZ && z <= areaRect.maxZ;

function staticLevel(e: StaticEntry): FadeLevel {
  if (!areaKey) return 0;
  if (e.veg) return groupOn ? 2 : 1;
  if (e.whole || !inside(e.cx, e.cz)) return 1;
  return groupOn ? 2 : 0;
}

function relevel() {
  for (const e of statics) {
    const l = staticLevel(e);
    e.mesh.material = l === 0 ? e.original : getFadeMaterials(e.original, l);
  }
  bump();
}

/** 블록 코드(야드 컨테이너·야드 크레인)의 현재 페이드 레벨 */
export function getBlockFadeLevel(code: string | undefined): FadeLevel {
  if (!areaKey || code == null) return 0;
  if (!areaBlocks.has(code)) return 1;
  return groupOn ? 2 : 0;
}
export function isAreaDepthFadeActive() {
  return areaKey != null;
}
/** 항만 전체를 덮는 위성지형용. 구역 Depth 진행도(레벨 1)에 따른 불투명도 */
export function getAreaWholeFadeOpacity() {
  return opacityOf(1);
}
export function useAreaDepthFadeVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

/** Ground 모델 배치 직후 1회: 안벽 크레인/위성지형/occupancy 복제 제외 정적 메시 수집 + 페이드 복제 미리 생성 */
export function bindAreaDepthFade(model: Object3D | null) {
  for (const e of statics) e.mesh.material = e.original;
  statics = [];
  staticByMesh.clear();
  if (!model) return;
  model.updateMatrixWorld(true);
  const box = new Box3();
  const size = new Vector3();
  const center = new Vector3();
  model.traverse((o) => {
    if (!(o instanceof Mesh) || o.name.endsWith("-occupancy")) return;
    if ([o.name, o.parent?.name ?? ""].some((n) => SAT_RE.test(n))) return; // [satfade] occupancy opacity 트윈과 합성 (Ground, getAreaWholeFadeOpacity)
    if (parseQuayCraneGlbIndex(o) != null) return; // craneDepthFade 담당
    box.setFromObject(o);
    if (box.isEmpty()) return;
    box.getSize(size);
    box.getCenter(center);
    const e: StaticEntry = { mesh: o, original: o.material, cx: center.x, cz: center.z, whole: Math.max(size.x, size.z) >= AREA_FADE_WHOLE_SPAN, veg: [o.name, o.parent?.name ?? ""].some((n) => VEGETATION_RE.test(n)) };
    getFadeMaterials(o.material, 1);
    getFadeMaterials(o.material, 2);
    statics.push(e);
    staticByMesh.set(o, e);
  });
  if (import.meta.env.DEV) {
    console.info(`[areafade] 정적 메시 ${statics.length}개, 통째 페이드: ${statics.filter((e) => e.whole).map((e) => e.mesh.name).join(", ")}`);
  }
  if (areaKey) relevel();
}

/** SceneWarmup: 정적 메시의 레벨 1/2 변형 (런타임 첫 페이드 히치 방지) */
export function getAreaFadeVariants(mesh: Mesh): (Material | Material[])[] {
  const e = staticByMesh.get(mesh);
  if (!e) return [];
  return [getFadeMaterials(e.original, 1), getFadeMaterials(e.original, 2)];
}

/** null = Depth 없음. group = 그룹(A1 …) Depth */
export function setAreaDepthFocus(next: { area: string; group: boolean } | null) {
  desired = next;
  target[1] = next ? 1 : 0;
  target[2] = next?.group ? 1 : 0;
  settle();
}

/** 목표/진행도에 따라 적용 포커스 갱신 (해제는 페이드 아웃 완료 후) */
function settle() {
  let changed = false;
  if (desired && desired.area !== areaKey) {
    const r = computeArea(desired.area);
    areaKey = desired.area;
    areaBlocks = r.members;
    areaRect = r.rect;
    changed = true;
  }
  if (desired?.group && !groupOn) {
    groupOn = true;
    changed = true;
  }
  if (groupOn && !desired?.group && progress[2] === 0) {
    groupOn = false;
    changed = true;
  }
  if (areaKey && !desired && progress[1] === 0 && progress[2] === 0) {
    areaKey = null;
    groupOn = false;
    areaBlocks = new Set();
    areaRect = null;
    changed = true;
  }
  if (changed) relevel();
}

/** 매 프레임 (Ground useFrame) */
export function updateAreaDepthFade(dt: number) {
  let moved = false;
  for (const l of [1, 2] as const) {
    const d = target[l]! - progress[l]!;
    if (d === 0) continue;
    const step = DEPTH_FADE_DURATION_S > 0 ? dt / DEPTH_FADE_DURATION_S : 1;
    progress[l] = Math.abs(d) <= step ? target[l]! : progress[l]! + Math.sign(d) * step;
    const k = opacityOf(l);
    for (const pair of clones.values()) {
      const c = pair[l - 1];
      c.opacity = (baseOpacity.get(c) ?? 1) * k;
    }
    moved = true;
  }
  if (moved) settle();
}
