import { createOccupancyMaterial } from "./occupancyMaterial";

export const OCCUPANCY_SURFACE_OPACITY = 0.25;
export const OCCUPANCY_SURFACE_COLOR = 0x3b82f6;

let occupancySurface: ReturnType<typeof createOccupancyMaterial> | null = null;

/** occupancy 지형 표면 — 앱 수명 동안 1개만 유지 */
export function getOccupancySurfaceMaterial() {
  occupancySurface ??= createOccupancyMaterial(
    OCCUPANCY_SURFACE_COLOR,
    OCCUPANCY_SURFACE_OPACITY,
  );
  return occupancySurface;
}

export function createOccupancySurfaceMaterial() {
  return getOccupancySurfaceMaterial();
}
