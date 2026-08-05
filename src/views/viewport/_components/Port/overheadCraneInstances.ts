import { BLOCKS, SLOT_MAX_SIZE } from "@/constants/block";
import { CONTAINER_D, CONTAINER_W, DECK_Y } from "@/constants/container";

export type OverHeadCraneInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

/** Block footprint 중앙 (데크 위) */
export function createBlockCenterCraneInstances(): OverHeadCraneInstance[] {
  const width = SLOT_MAX_SIZE.rows * CONTAINER_W;
  const length = SLOT_MAX_SIZE.bays * CONTAINER_D;

  return BLOCKS.map((block) => ({
    position: [
      block.origin[0] + width + width / 3,
      DECK_Y,
      block.origin[2] + length / 2,
    ] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: 1.5,
  }));
}
