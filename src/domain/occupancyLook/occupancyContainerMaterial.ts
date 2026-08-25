import { createOccupancyMaterial } from "./occupancyMaterial";

export const OCCUPANCY_CONTAINER_OPACITY = 0.8;
export const OCCUPANCY_CONTAINER_COLOR = 0x3ba2f6;

let occupancyContainer: ReturnType<typeof createOccupancyMaterial> | null =
  null;

/** occupancy 컨테이너 — 선체와 별도 인스턴스 */
export function getOccupancyContainerMaterial() {
  occupancyContainer ??= createOccupancyMaterial(
    OCCUPANCY_CONTAINER_COLOR,
    OCCUPANCY_CONTAINER_OPACITY,
  );
  return occupancyContainer;
}
