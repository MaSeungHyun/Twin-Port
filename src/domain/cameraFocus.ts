import {
  CRANE_INSTANCES,
  SHIP_INSTANCES,
  SHIP_PLACEMENTS,
} from "@/constants/model";
import { SHIP_TRACKING_TARGET_Y_OFFSET } from "@/constants/camera";
import type { QuayCranePlacement } from "@/domain/extractQuayBerths";
import { getQuayCraneWorldTrackingTarget } from "@/domain/hoverOutline";
import {
  formatQuayCraneGlbName,
  resolveQuayCraneGlbIndexFromKey,
} from "@/domain/quayCraneIndex";
import { getShipPoseAt } from "@/domain/shipWake";
import { useYardStore } from "@/stores/yard";
import {
  createBlockCenterCraneInstances,
  getOverheadCraneLivePosition,
  type OverHeadCraneInstance,
} from "@/views/viewport/_components/Port/overheadCraneInstances";
import { type Object3D, Vector3 } from "three";

let quayCraneModel: Object3D | null = null;

/** Ground GLB — tracking 시 live bbox center 조회 */
export function bindQuayCraneModel(model: Object3D | null) {
  quayCraneModel = model;
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
