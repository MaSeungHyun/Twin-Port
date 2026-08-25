import { createOccupancyMaterial } from "./occupancyMaterial";

export const OCCUPANCY_SHIP_OPACITY = 0.58;
export const OCCUPANCY_SHIP_COLOR = 0x3ba2f6;

/** true면 occupancy 모드가 아니어도 선체에 occupancy 머티리얼을 씀 (테스트용) */
export const DEBUG_SHIP_OCCUPANCY_MATERIAL = true;

let occupancyShip: ReturnType<typeof createOccupancyMaterial> | null = null;

/** occupancy 선체 — 컨테이너와 별도 인스턴스 */
export function getOccupancyShipMaterial() {
  occupancyShip ??= createOccupancyMaterial(
    OCCUPANCY_SHIP_COLOR,
    OCCUPANCY_SHIP_OPACITY,
  );
  return occupancyShip;
}
