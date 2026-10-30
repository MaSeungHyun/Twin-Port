import areaCamUrl from "@/assets/model/Area_Cam.glb";
import {
  AREA_C_BLOCK_CODE_PATTERN,
  AREA_C_BLOCK_RANGE,
  AREA_C_CAM_HEIGHT_RATIO,
  AREA_C_CAM_MIN_DISTANCE,
  AREA_C_CAM_SPAN_FACTOR,
  AREA_CAM_BUTTON_LIFT,
  AREA_CAM_MOVE_DURATION,
  AREA_CAM_TARGET_DISTANCE,
  AREA_CAM_TARGET_MIN_DISTANCE,
  AREA_CAM_TARGETS,
  AREA_CRANE_RANGES,
  AREA_DEPTH_LEVEL,
  CAMERA_FLY_TO_EVENT,
  CRANE_GROUP_BUTTON_LIFT,
  CRANE_GROUP_CAM_DISTANCE,
  CRANE_GROUP_CAM_HEIGHT,
  CRANE_GROUP_DEPTH_LEVEL,
  CRANE_GROUP_SHIP_SEARCH_RADIUS,
  CRANE_GROUP_TARGET_SHIP_BLEND,
  CRANE_GROUP_TARGET_SHIP_MAX_SHIFT,
  CRANE_GROUP_SIZE,
  type AreaCamTarget,
  type CameraFlyToDetail,
} from "@/constants/areaCam";
import { getBlockFootprintCorners } from "@/domain/blockFootprint";
import { getCraneFocusTarget, getShipFocusTarget } from "@/domain/cameraFocus";
import { SHIP_INSTANCES } from "@/constants/model";
import { useCameraDepthStore } from "@/stores/cameraDepth";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { Html, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { memo, useMemo } from "react";
import { Box3, Quaternion, Vector3, type Object3D } from "three";

type Resolved = Omit<AreaCamTarget, "glb"> & { point: [number, number, number]; fly: CameraFlyToDetail };
type CraneGroup = { label: string; cranes: number[]; button: [number, number, number]; center: Vector3; side: Vector3 };

const findNode = (root: Object3D, name: string) => {
  const n = name.toLowerCase();
  let hit: Object3D | null = null;
  root.traverse((o) => { if (!hit && o.name.toLowerCase() === n) hit = o; });
  return hit as Object3D | null;
};
const tuple = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
const fly = (detail: CameraFlyToDetail) => window.dispatchEvent(new CustomEvent<CameraFlyToDetail>(CAMERA_FLY_TO_EVENT, { detail }));

const BUTTON_CLASS =
  "flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-2 border-white/60 bg-[#00000080] px-md py-xs text-xl font-light tracking-wide text-text-primary shadow-lg transition-all duration-200 ease-out hover:scale-110 hover:border-primary hover:bg-primary/80 hover:text-black hover:shadow-[0_0_12px_rgba(255,255,255,0.35)] active:scale-100";

/** [areagroup] 구역 크레인(존재하는 GLB index 순)을 CRANE_GROUP_SIZE 개씩 연속 묶음 → 가운데 크레인 위 버튼 */
function buildCraneGroups(key: string, glbIndices: number[]): CraneGroup[] {
  const range = AREA_CRANE_RANGES[key];
  if (!range) return [];
  const ids = [...new Set(glbIndices)].filter((i) => i >= range[0] && i <= range[1]).sort((a, b) => a - b);
  const out: CraneGroup[] = [];
  for (let g = 0; g * CRANE_GROUP_SIZE < ids.length; g++) {
    const cranes = ids.slice(g * CRANE_GROUP_SIZE, (g + 1) * CRANE_GROUP_SIZE);
    const pts = cranes.map((i) => getCraneFocusTarget(i)).filter((v): v is Vector3 => v != null);
    if (!pts.length) continue;
    const mid = pts[Math.floor(pts.length / 2)]!;
    const center = pts.reduce((a, p) => a.add(p), new Vector3()).divideScalar(pts.length);
    const dir = pts.length > 1 ? pts[pts.length - 1]!.clone().sub(pts[0]!).setY(0) : new Vector3(1, 0, 0);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    out.push({ label: `${key}${g + 1}`, cranes, button: [mid.x, mid.y + CRANE_GROUP_BUTTON_LIFT, mid.z], center, side: new Vector3(-dir.z, 0, dir.x) });
  }
  return out;
}

/** [areagroup] 그룹 중심에서 가장 가까운 선박(실시간 위치, 반경 안) */
function nearestShip(center: Vector3): Vector3 | null {
  const count = Math.max(useYardStore.getState().ships.length, SHIP_INSTANCES.length);
  let best: Vector3 | null = null;
  let bestD = CRANE_GROUP_SHIP_SEARCH_RADIUS;
  for (let i = 0; i < count; i++) {
    const s = getShipFocusTarget(`ship-${i}`);
    if (!s) continue;
    const d = Math.hypot(s.x - center.x, s.z - center.z);
    if (d < bestD) { bestD = d; best = s.setY(center.y); }
  }
  return best;
}

/** [areac] C구역(코드 생성) — 블록 B21~B27 footprint 중심에 버튼, 크레인 43~48 + 블록을 바다 쪽에서 프레이밍 */
function buildAreaCFallback(t: AreaCamTarget): Resolved | null {
  const range = AREA_CRANE_RANGES[t.key];
  if (!range) return null;
  const box = new Box3();
  const found: string[] = [];
  for (const b of useYardStore.getState().blocks) {
    const m = AREA_C_BLOCK_CODE_PATTERN.exec(b.code);
    if (!m) continue;
    const n = Number(m[1]);
    if (n < AREA_C_BLOCK_RANGE[0] || n > AREA_C_BLOCK_RANGE[1]) continue;
    for (const c of getBlockFootprintCorners(b, b.origin[1])) box.expandByPoint(new Vector3(c[0], c[1], c[2]));
    found.push(b.code);
  }
  const cranes: Vector3[] = [];
  for (let i = range[0]; i <= range[1]; i++) {
    const v = getCraneFocusTarget(i);
    if (v) cranes.push(v);
  }
  if (import.meta.env.DEV) console.info(`[areac] 블록 ${found.join(", ") || "없음"} / 크레인 ${cranes.length}대`);
  if (box.isEmpty() || !cranes.length) return null;
  const blockCenter = box.getCenter(new Vector3());
  const craneCenter = cranes.reduce((a, p) => a.add(p), new Vector3()).divideScalar(cranes.length);
  const all = box.clone();
  for (const c of cranes) all.expandByPoint(c);
  const size = all.getSize(new Vector3());
  const target = blockCenter.clone().add(craneCenter).multiplyScalar(0.5);
  // 크레인 줄의 수직 방향, 바다(선박) 쪽 — 선박 없으면 블록 반대쪽
  const dir = cranes.length > 1 ? cranes[cranes.length - 1]!.clone().sub(cranes[0]!).setY(0) : new Vector3(1, 0, 0);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
  dir.normalize();
  const side = new Vector3(-dir.z, 0, dir.x);
  const ship = nearestShip(craneCenter);
  const ref = ship ? ship.clone().sub(craneCenter) : craneCenter.clone().sub(blockCenter);
  if (side.dot(ref) < 0) side.negate();
  const dist = Math.max(AREA_C_CAM_MIN_DISTANCE, Math.max(size.x, size.z) * AREA_C_CAM_SPAN_FACTOR);
  const p = target.clone().addScaledVector(side, dist);
  p.y += dist * AREA_C_CAM_HEIGHT_RATIO;
  return { id: t.id, key: t.key, label: t.label, point: [blockCenter.x, box.max.y + AREA_CAM_BUTTON_LIFT, blockCenter.z], fly: { p: tuple(p), t: tuple(target), duration: AREA_CAM_MOVE_DURATION, depth: { level: AREA_DEPTH_LEVEL, label: t.label } } };
}

/** [areacam] area_point_X 에 버튼, 클릭 → CAM_X 위치·방향으로 부드럽게 이동 (CameraSlots 트윈 재사용, 이후 OrbitControls 그대로 사용 가능)
 *  [areagroup] 구역 Depth 안에서는 구역 버튼을 숨기고 크레인 그룹 버튼(A1, A2 …) 표시 */
function AreaCamButtons() {
  const { scene } = useGLTF(areaCamUrl);
  const interactionReady = useViewportStore((s) => s.interactionReady);
  const stack = useCameraDepthStore((s) => s.stack);
  const quayCranes = useYardStore((s) => s.quayCranes);
  const blocks = useYardStore((s) => s.blocks);
  const camera = useThree((s) => s.camera);

  const targets = useMemo<Resolved[]>(() => {
    scene.updateMatrixWorld(true);
    const out: Resolved[] = [];
    for (const t of AREA_CAM_TARGETS) {
      if (!t.glb) {
        const c = buildAreaCFallback(t);
        if (c) out.push(c);
        continue;
      }
      const pointNode = findNode(scene, t.glb.point), camNode = findNode(scene, t.glb.cam);
      if (!pointNode || !camNode) {
        if (import.meta.env.DEV) console.info(`[areacam] ${t.label} 건너뜀 — Area_Cam.glb 에 ${!pointNode ? t.glb.point : t.glb.cam} 없음`);
        continue;
      }
      const point = pointNode.getWorldPosition(new Vector3());
      const pos = camNode.getWorldPosition(new Vector3());
      // GLTF 카메라 노드는 로컬 -Z 를 바라봄
      const forward = new Vector3(0, 0, -1).applyQuaternion(camNode.getWorldQuaternion(new Quaternion())).normalize();
      const along = point.clone().sub(pos).dot(forward);
      const dist = along > AREA_CAM_TARGET_MIN_DISTANCE ? along : AREA_CAM_TARGET_DISTANCE;
      out.push({ id: t.id, key: t.key, label: t.label, point: [point.x, point.y + AREA_CAM_BUTTON_LIFT, point.z], fly: { p: tuple(pos), t: tuple(pos.clone().addScaledVector(forward, dist)), duration: AREA_CAM_MOVE_DURATION, depth: { level: AREA_DEPTH_LEVEL, label: t.label } } });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- C fallback 은 Ground 모델·크레인 배치 준비 후 다시 계산
  }, [scene, quayCranes, blocks, interactionReady]);

  const area = stack.length ? AREA_CAM_TARGETS.find((t) => t.label === stack[0]!.label) : undefined;
  const groups = useMemo(
    () => (area ? buildCraneGroups(area.key, quayCranes.map((c) => c.glbIndex).filter((i): i is number => typeof i === "number")) : []),
    [area, quayCranes],
  );

  if (!interactionReady) return null;
  if (stack.length) {
    return (
      <>
        {groups.map((g) => (
          <Html key={g.label} position={g.button} center zIndexRange={[30, 21]} style={{ userSelect: "none" }}>
            <button
              type="button"
              className={BUTTON_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                // 바다(가장 가까운 정박 선박) 쪽에서 안벽을 보도록. 선박이 없으면 현재 카메라 쪽
                const side = g.side.clone();
                const ship = nearestShip(g.center);
                const ref = ship ? ship.clone().sub(g.center) : camera.position.clone().sub(g.center);
                if (side.dot(ref) < 0) side.negate();
                const target = g.center.clone();
                if (ship) {
                  const off = Math.min(Math.max(0, side.dot(ref)) * CRANE_GROUP_TARGET_SHIP_BLEND, CRANE_GROUP_TARGET_SHIP_MAX_SHIFT);
                  target.addScaledVector(side, off); // 크레인과 배 사이를 바라봄
                }
                const p = target.clone().addScaledVector(side, CRANE_GROUP_CAM_DISTANCE);
                p.y += CRANE_GROUP_CAM_HEIGHT;
                fly({ p: tuple(p), t: tuple(target), duration: AREA_CAM_MOVE_DURATION, depth: { level: CRANE_GROUP_DEPTH_LEVEL, label: g.label } });
              }}
            >
              {g.label}
            </button>
          </Html>
        ))}
      </>
    );
  }
  return (
    <>
      {targets.map((t) => (
        <Html key={t.id} position={t.point} center zIndexRange={[30, 21]} style={{ userSelect: "none" }}>
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={(e) => {
              e.stopPropagation();
              fly(t.fly);
            }}
          >
            {t.label}
          </button>
        </Html>
      ))}
    </>
  );
}

useGLTF.preload(areaCamUrl);
export default memo(AreaCamButtons);
