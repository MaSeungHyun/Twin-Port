import {
  CRANE_INSTANCES,
  SHIP_INSTANCES,
  SHIP_PLACEMENTS,
} from "@/constants/model";
import type { QuayCranePlacement } from "@/domain/extractQuayBerths";
import { getShipPoseAt } from "@/domain/shipWake";
import { useYardStore } from "@/stores/yard";
import { Vector3 } from "three";

export function resolveShipIndex(key: string): number | null {
  if (key.startsWith("ship-")) {
    const index = Number.parseInt(key.slice(5), 10);
    return Number.isFinite(index) ? index : null;
  }
  const index = SHIP_PLACEMENTS.findIndex((placement) => placement.label === key);
  return index >= 0 ? index : null;
}

export function resolveCraneIndex(key: string): number | null {
  if (!key.startsWith("crane-")) return null;
  const index = Number.parseInt(key.slice(6), 10);
  return Number.isFinite(index) ? index : null;
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
  return new Vector3(x, Math.max(y, 0) + 1.5, z);
}

function cranePlacements(): readonly QuayCranePlacement[] {
  return useYardStore.getState().quayCranes;
}

export function getCraneFocusTarget(index: number): Vector3 | null {
  const fromModel = cranePlacements()[index];
  if (fromModel) {
    const [x, y, z] = fromModel.position;
    return new Vector3(x, y, z);
  }

  const fallback = CRANE_INSTANCES[index];
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
    placements: CRANE_INSTANCES.map((crane, index) => ({
      kind: "crane" as const,
      mesh: `Crane ${index + 1}`,
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
