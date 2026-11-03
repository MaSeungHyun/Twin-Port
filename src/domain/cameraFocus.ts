import {
  CRANE_INSTANCES,
  SHIP_INSTANCES,
  SHIP_PLACEMENTS,
} from "@/constants/model";
import {
  CRANE_TRACKING_HEAD_LIFT,
  CRANE_TRACKING_SEA_DISTANCE,
  SHIP_TRACKING_TARGET_Y_OFFSET,
} from "@/constants/camera";
import type { QuayCranePlacement } from "@/domain/extractQuayBerths";
import { getQuayCraneWorldTrackingTarget } from "@/domain/hoverOutline";
import {
  formatQuayCraneGlbName,
  parseQuayCraneGlbIndex,
  resolveQuayCraneGlbIndexFromKey,
} from "@/domain/quayCraneIndex";
import { getShipPoseAt } from "@/domain/shipWake";
import { useYardStore } from "@/stores/yard";
import {
  createBlockCenterCraneInstances,
  getOverheadCraneLivePosition,
  type OverHeadCraneInstance,
} from "@/views/viewport/_components/Port/overheadCraneInstances";
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Object3D,
  Raycaster,
  Vector3,
} from "three";

let quayCraneModel: Object3D | null = null;

/** Ground GLB — tracking 시 live bbox center 조회 */
export function bindQuayCraneModel(model: Object3D | null) {
  quayCraneModel = model;
  quayCalloutOffset.clear();
}

export function resolveShipIndex(key: string): number | null {
  if (key.startsWith("ship-")) {
    const index = Number.parseInt(key.slice(5), 10);
    return Number.isFinite(index) ? index : null;
  }
  const index = SHIP_PLACEMENTS.findIndex((placement) => placement.label === key);
  return index >= 0 ? index : null;
}

/** UI key crane-52 → GLB index 52 */
export function resolveCraneIndex(key: string): number | null {
  return resolveQuayCraneGlbIndexFromKey(key);
}

/** 선박 월드 포커스 — tween 중이면 live pose 우선 */
export function getShipFocusTarget(key: string): Vector3 | null {
  const index = resolveShipIndex(key);
  if (index == null) return null;

  const live = getShipPoseAt(index);
  const modelShips = useYardStore.getState().ships;
  const berths = modelShips.length > 0 ? modelShips : SHIP_INSTANCES;
  const berth = live ?? berths[index];
  if (!berth) return null;

  const [x, y, z] = berth.position;
  return new Vector3(x, Math.max(y, 0) + SHIP_TRACKING_TARGET_Y_OFFSET, z);
}

function cranePlacements(): readonly QuayCranePlacement[] {
  return useYardStore.getState().quayCranes;
}

export function getCranePlacement(glbIndex: number): QuayCranePlacement | null {
  return cranePlacements().find((crane) => crane.glbIndex === glbIndex) ?? null;
}

/** quay crane 월드 포커스 — GLB index(crane.052→52) 기준 */
export function getCraneFocusTarget(glbIndex: number): Vector3 | null {
  if (quayCraneModel) {
    const fromScene = getQuayCraneWorldTrackingTarget(quayCraneModel, glbIndex);
    if (fromScene) return fromScene;
  }

  const fromModel = getCranePlacement(glbIndex);
  if (fromModel) {
    const [x, y, z] = fromModel.position;
    return new Vector3(x, y, z);
  }

  const fallback = CRANE_INSTANCES[glbIndex];
  if (!fallback) return null;

  const [x, , z] = fallback.position;
  return new Vector3(x, 6, z);
}

const craneShotBox = new Box3();
const craneShotLocal = new Box3();
const craneShotInv = new Matrix4();
const craneShotCorner = new Vector3();
const craneShotSea = new Vector3();

function craneRoot(glbIndex: number): Object3D | null {
  if (!quayCraneModel) return null;
  let root: Object3D | null = null;
  quayCraneModel.traverse((node) => {
    if (root || parseQuayCraneGlbIndex(node) !== glbIndex) return;
    root = node;
  });
  return root;
}

/** 안벽 크레인: 붐이 향하는 바다(선박) 쪽에서 머리(붐 끝)를 바라보는 카메라 */
export function getCraneTrackingShot(
  glbIndex: number,
): { target: Vector3; position: Vector3 } | null {
  const center = getCraneFocusTarget(glbIndex);
  if (!center) return null;

  const root = craneRoot(glbIndex);
  craneShotBox.makeEmpty();
  if (root) {
    root.updateWorldMatrix(true, true);
    craneShotInv.copy(root.matrixWorld).invert();
    craneShotLocal.makeEmpty();
    root.traverse((child) => {
      if (!(child instanceof Mesh) || child.name.endsWith("-occupancy")) return;
      if (parseQuayCraneGlbIndex(child) !== glbIndex) return;
      const geometry = child.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      const { min, max } = geometry.boundingBox;
      for (const x of [min.x, max.x]) {
        for (const y of [min.y, max.y]) {
          for (const z of [min.z, max.z]) {
            craneShotCorner
              .set(x, y, z)
              .applyMatrix4(child.matrixWorld)
              .applyMatrix4(craneShotInv);
            craneShotLocal.expandByPoint(craneShotCorner);
          }
        }
      }
    });
  }

  craneShotSea.set(1, 0, 0);
  if (root && !craneShotLocal.isEmpty()) {
    const extent = [
      craneShotLocal.max.x - craneShotLocal.min.x,
      craneShotLocal.max.y - craneShotLocal.min.y,
      craneShotLocal.max.z - craneShotLocal.min.z,
    ];
    let best = -1;
    for (let axis = 0; axis < 3; axis += 1) {
      craneShotCorner.setFromMatrixColumn(root.matrixWorld, axis);
      const xz = Math.hypot(craneShotCorner.x, craneShotCorner.z);
      if (xz < 1e-8) continue;
      const worldSize = Math.max(extent[axis]!, 1e-8) * craneShotCorner.length();
      if (worldSize <= best) continue;
      best = worldSize;
      craneShotSea.set(craneShotCorner.x / xz, 0, craneShotCorner.z / xz);
    }
    for (const x of [craneShotLocal.min.x, craneShotLocal.max.x]) {
      for (const y of [craneShotLocal.min.y, craneShotLocal.max.y]) {
        for (const z of [craneShotLocal.min.z, craneShotLocal.max.z]) {
          craneShotCorner.set(x, y, z).applyMatrix4(root.matrixWorld);
          craneShotBox.expandByPoint(craneShotCorner);
        }
      }
    }
  }
  if (craneShotBox.isEmpty()) {
    craneShotBox.setFromCenterAndSize(center, craneShotCorner.set(20, 40, 80));
  }

  const origin = root
    ? craneShotCorner.setFromMatrixPosition(root.matrixWorld)
    : center;
  let forward = 0;
  let back = 0;
  {
    const min = craneShotBox.min;
    const max = craneShotBox.max;
    for (const x of [min.x, max.x]) {
      for (const z of [min.z, max.z]) {
        const along =
          (x - origin.x) * craneShotSea.x + (z - origin.z) * craneShotSea.z;
        forward = Math.max(forward, along);
        back = Math.max(back, -along);
      }
    }
  }
  if (back > forward) craneShotSea.negate();
  const span = Math.max(forward, back);
  if (span > 1e-3 && Math.abs(forward - back) < span * 0.15) {
    let seaX = 0;
    let seaZ = 0;
    let bestShip = Infinity;
    const shipCount = Math.max(
      useYardStore.getState().ships.length,
      SHIP_INSTANCES.length,
    );
    for (let i = 0; i < shipCount; i += 1) {
      const ship = getShipFocusTarget(`ship-${i}`);
      if (!ship) continue;
      const dx = ship.x - center.x;
      const dz = ship.z - center.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= bestShip) continue;
      bestShip = distance;
      seaX = dx;
      seaZ = dz;
    }
    if (bestShip < Infinity && craneShotSea.x * seaX + craneShotSea.z * seaZ < 0) {
      craneShotSea.negate();
    }
  }

  let reach = 0;
  let headY = center.y;
  const min = craneShotBox.min;
  const max = craneShotBox.max;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const along =
          (x - center.x) * craneShotSea.x + (z - center.z) * craneShotSea.z;
        if (along >= reach) {
          reach = along;
          headY = Math.max(headY, y);
        }
      }
    }
  }

  const target = new Vector3(
    center.x + craneShotSea.x * reach,
    headY,
    center.z + craneShotSea.z * reach,
  );
  const position = target
    .clone()
    .addScaledVector(craneShotSea, CRANE_TRACKING_SEA_DISTANCE);
  position.y += CRANE_TRACKING_HEAD_LIFT;
  return { target, position };
}

export function getCraneListSource(): {
  placements: readonly QuayCranePlacement[];
  fromModel: boolean;
} {
  const placements = cranePlacements();
  if (placements.length > 0) {
    return { placements, fromModel: true };
  }
  return {
    placements: CRANE_INSTANCES.map((crane, glbIndex) => ({
      glbIndex,
      kind: "crane" as const,
      mesh: formatQuayCraneGlbName(glbIndex),
      position: [
        crane.position[0],
        6,
        crane.position[2],
      ] as [number, number, number],
      height: 0,
    })),
    fromModel: false,
  };
}

let ohcCache: {
  blocks: unknown;
  deckY: number;
  instances: OverHeadCraneInstance[];
} | null = null;

function overheadCraneInstances(): OverHeadCraneInstance[] {
  const { blocks, deckY } = useYardStore.getState();
  if (!ohcCache || ohcCache.blocks !== blocks || ohcCache.deckY !== deckY) {
    ohcCache = {
      blocks,
      deckY,
      instances: createBlockCenterCraneInstances(blocks, deckY),
    };
  }
  return ohcCache.instances;
}

/** overhead crane 월드 포커스 — 왕복 중 live 위치 + 높이 절반 */
export function getOverheadCraneFocusTarget(index: number): Vector3 | null {
  const instance = overheadCraneInstances()[index];
  if (!instance) return null;
  const [x, y, z] = getOverheadCraneLivePosition(index) ?? instance.position;
  const height = instance.fit?.[1] ?? 10;
  return new Vector3(x, y + height * 0.5, z);
}

/** 상태 라벨 원점 — 크레인 몸통. 거더 끝은 멀리서 점만 공중에 떠 어느 크레인인지 안 보인다 */
/** 상단 거더 윗면(인스턴스 fit 높이 = 바닥 y 기준 크레인 전체 높이) */
const OVERHEAD_CALLOUT_HEIGHT_RATIO = 1;

export function getOverheadCraneCalloutAnchor(
  index: number,
  out: Vector3 = new Vector3(),
): Vector3 | null {
  const instance = overheadCraneInstances()[index];
  if (!instance) return null;
  const live = getOverheadCraneLivePosition(index);
  const [x, y, z] = live ?? instance.position;
  const height = instance.fit?.[1] ?? 12;
  return out.set(x, y + height * OVERHEAD_CALLOUT_HEIGHT_RATIO, z);
}

/** 콜아웃 원을 안벽 크레인 실제 표면에 붙이기 위한 bbox 중심 대비 오프셋(1회 레이캐스트 후 캐시) */
const quayCalloutOffset = new Map<number, Vector3>();
const calloutRay = new Raycaster();
const calloutBox = new Box3();
const calloutPart = new Box3();
const calloutMatrix = new Matrix4();
const calloutOrigin = new Vector3();
const calloutDown = new Vector3(0, -1, 0);

function quayCraneWorldBox(glbIndex: number): Box3 | null {
  const root = craneRoot(glbIndex);
  if (!root) return null;
  root.updateWorldMatrix(true, true);
  calloutBox.makeEmpty();
  root.traverse((child) => {
    if (!(child instanceof Mesh) || child.name.endsWith("-occupancy")) return;
    const geometry = child.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    if (child instanceof InstancedMesh) {
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, calloutMatrix);
        calloutMatrix.premultiply(child.matrixWorld);
        calloutPart.copy(geometry.boundingBox).applyMatrix4(calloutMatrix);
        calloutBox.union(calloutPart);
      }
      return;
    }
    calloutPart.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld);
    calloutBox.union(calloutPart);
  });
  return calloutBox.isEmpty() ? null : calloutBox;
}

/** 안벽 크레인 콜아웃 앵커: 현재 world bbox 중심 위에서 아래로 쏜 첫 크레인 표면(윗면). 빗나가면 bbox 윗면 중심 */
export function getQuayCraneCalloutAnchor(
  glbIndex: number,
  out: Vector3 = new Vector3(),
): Vector3 | null {
  const box = quayCraneWorldBox(glbIndex);
  if (!box) {
    const center = getCraneFocusTarget(glbIndex);
    return center ? out.copy(center) : null;
  }
  box.getCenter(out);
  let offset = quayCalloutOffset.get(glbIndex);
  if (!offset) {
    const root = craneRoot(glbIndex)!;
    calloutOrigin.set(out.x, box.max.y + 5, out.z);
    calloutRay.set(calloutOrigin, calloutDown);
    calloutRay.far = box.max.y - box.min.y + 10;
    const hit = calloutRay
      .intersectObject(root, true)
      .find((h) => !h.object.name.endsWith("-occupancy"));
    offset = hit
      ? new Vector3().subVectors(hit.point, out)
      : new Vector3(0, box.max.y - out.y, 0);
    quayCalloutOffset.set(glbIndex, offset);
  }
  return out.add(offset);
}
