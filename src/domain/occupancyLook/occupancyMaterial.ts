import { MeshStandardMaterial } from "three";

/** occupancy 반투명 표면 — 선체 / 컨테이너 / 지형이 같은 셰이더 설정을 공유 */
export function createOccupancyMaterial(color: number, opacity: number) {
  return new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0.05,
  });
}
