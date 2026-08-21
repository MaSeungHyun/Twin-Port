import { MeshStandardMaterial } from "three";

/** occupancy 모드 지형·선체 공통 표면 */
export function createOccupancySurfaceMaterial() {
  return new MeshStandardMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0.05,
  });
}
