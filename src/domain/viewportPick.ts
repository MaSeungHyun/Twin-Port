import { SHIP_PLACEMENTS } from "@/constants/model";
import { SHIP_TWEEN } from "@/constants/tween";
import { parseQuayCraneGlbIndex } from "@/domain/quayCraneIndex";
import { instanceHoverId } from "@/domain/hoverOutline";
import { useContentViewStore } from "@/stores/contentView";
import { useYardStore } from "@/stores/yard";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import type { ThreeEvent } from "@react-three/fiber";

function shipInstanceScale(instance: ShipInstance) {
  const scale = instance.scale ?? 1;
  return typeof scale === "number" ? scale : scale[0];
}

export function resolveShipKeyFromInstanceIndex(index: number): string | null {
  const modelShips = useYardStore.getState().ships;
  if (modelShips.length > 0) {
    if (index < 0 || index >= modelShips.length) return null;
    return `ship-${index}`;
  }
  return SHIP_PLACEMENTS[index]?.label ?? null;
}

export function pickShipKeyFromClick(
  event: ThreeEvent<PointerEvent>,
  instances: readonly ShipInstance[],
): string | null {
  const id = instanceHoverId(event);
  if (id == null) return null;
  const index = Number(id);
  if (!Number.isInteger(index) || index < 0 || index >= instances.length) {
    return null;
  }
  const instance = instances[index];
  if (
    !instance ||
    shipInstanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2
  ) {
    return null;
  }
  return resolveShipKeyFromInstanceIndex(index);
}

export function pickCraneGlbIndexFromClick(
  event: ThreeEvent<PointerEvent>,
): number | null {
  return parseQuayCraneGlbIndex(event.object);
}

export function activateShipFromViewport(key: string) {
  useContentViewStore.getState().openShipDetail(key);
}

export function activateCraneFromViewport(glbIndex: number) {
  useContentViewStore.getState().openCraneDetail(`crane-${glbIndex}`);
}

export function setViewportPickCursor(active: boolean) {
  document.body.style.cursor = active ? "pointer" : "";
}
