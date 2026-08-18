import {
  BLOCKS,
  getBlockSlotGrid,
  type BlockDefinition,
} from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import type { Vec3 } from "@/constants/geometry";
import {
  OVERHEAD_CRANE_SCALE,
  OVERHEAD_CRANE_SPAN_X,
} from "@/constants/model";

export type OverHeadCraneInstance = {
  /** 기준 위치 (레일 중간, Y 고정) */
  position: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  /** 블록 로컬 베이 방향 왕복 끝점 */
  start: Vec3;
  end: Vec3;
  /** rad/s — sin 왕복 속도 */
  speed: number;
  /** 시작 위상 (블록마다 다르게) */
  phase: number;
};

function blockLocalToWorld(
  origin: Vec3,
  yaw: number,
  lx: number,
  y: number,
  lz: number,
): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    origin[0] + lx * c + lz * s,
    y,
    origin[2] + -lx * s + lz * c,
  ];
}

/** Block footprint 위에서 베이 방향으로 왕복할 크레인 인스턴스 */
export function createBlockCenterCraneInstances(
  blocks: readonly BlockDefinition[] = BLOCKS,
  deckY = DECK_Y,
): OverHeadCraneInstance[] {
  return blocks.map((block, index) => {
    const grid = getBlockSlotGrid(block);
    const width = grid.sizeX;
    const length = grid.sizeZ;
    const inset = length * 0.08;
    const yaw = block.yaw ?? 0;
    const y = deckY + block.origin[1];
    const scale =
      OVERHEAD_CRANE_SCALE * (width / OVERHEAD_CRANE_SPAN_X);
    const localX = width / 2;
    const start = blockLocalToWorld(block.origin, yaw, localX, y, inset);
    const end = blockLocalToWorld(block.origin, yaw, localX, y, length - inset);

    return {
      position: [
        (start[0] + end[0]) / 2,
        y,
        (start[2] + end[2]) / 2,
      ],
      rotation: [0, yaw, 0],
      scale,
      start,
      end,
      speed: 0.09 + (index % 7) * 0.02,
      phase: index * 0.85,
    };
  });
}
