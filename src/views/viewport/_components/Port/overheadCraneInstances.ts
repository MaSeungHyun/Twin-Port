import { BLOCKS, SLOT_MAX_SIZE } from "@/constants/block";
import { CONTAINER_D, CONTAINER_W, DECK_Y } from "@/constants/container";

export type OverHeadCraneInstance = {
  /** 기준 위치 (X/Y 고정, Z는 애니메이션) */
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  /** Block 위 Z 이동 구간 */
  zMin: number;
  zMax: number;
  /** rad/s — sin 왕복 속도 */
  speed: number;
  /** 시작 위상 (블록마다 다르게) */
  phase: number;
};

/** Block footprint 위에서 Z축으로 왕복할 크레인 인스턴스 */
export function createBlockCenterCraneInstances(): OverHeadCraneInstance[] {
  const width = SLOT_MAX_SIZE.rows * CONTAINER_W;
  const length = SLOT_MAX_SIZE.bays * CONTAINER_D;
  const inset = length * 0.08;

  return BLOCKS.map((block, index) => {
    const x = block.origin[0] + width + width / 3 + 0.55;
    const zMin = block.origin[2] + inset;
    const zMax = block.origin[2] + length - inset;

    return {
      position: [x, DECK_Y, (zMin + zMax) / 2] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: 1.5,
      zMin,
      zMax,
      // 속도·위상 분산 → 동시에 같은 위치로 몰리지 않음
      speed: 0.09 + (index % 7) * 0.02,
      phase: index * 0.85,
    };
  });
}
