import { BLOCKS, getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { DECK_Y } from "@/constants/container";

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
export function createBlockCenterCraneInstances(
  blocks: readonly BlockDefinition[] = BLOCKS,
  deckY = DECK_Y,
): OverHeadCraneInstance[] {
  return blocks.map((block, index) => {
    const grid = getBlockSlotGrid(block);
    const width = grid.sizeX;
    const length = grid.sizeZ;
    const inset = length * 0.08;

    const x = block.origin[0] + width + width / 3 + 0.55;
    const zMin = block.origin[2] + inset;
    const zMax = block.origin[2] + length - inset;

    return {
      position: [x, deckY + block.origin[1], (zMin + zMax) / 2] as [
        number,
        number,
        number,
      ],
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
