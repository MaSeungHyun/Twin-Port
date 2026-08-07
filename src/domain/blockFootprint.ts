import { SLOT_MAX_SIZE } from "@/constants/block";
import { CONTAINER_D, CONTAINER_W } from "@/constants/container";
import type { BlockDefinition } from "@/constants/block";
import type { Vec3 } from "@/constants/geometry";

/** Block 야드 footprint (Row=X, Bay=Z) */
export const BLOCK_FOOTPRINT_WIDTH = SLOT_MAX_SIZE.rows * CONTAINER_W;
export const BLOCK_FOOTPRINT_DEPTH = SLOT_MAX_SIZE.bays * CONTAINER_D;

export function getBlockFootprintCenter(origin: Vec3): Vec3 {
  return [
    origin[0] + BLOCK_FOOTPRINT_WIDTH / 2,
    origin[1],
    origin[2] + BLOCK_FOOTPRINT_DEPTH / 2,
  ];
}

export function getBlockFootprintCorners(origin: Vec3, y: number) {
  const x0 = origin[0];
  const z0 = origin[2];
  const x1 = x0 + BLOCK_FOOTPRINT_WIDTH;
  const z1 = z0 + BLOCK_FOOTPRINT_DEPTH;

  return [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ] as const;
}

export type BlockFrameSegment = {
  position: Vec3;
  scale: Vec3;
};

/** 바닥·라인 공통 바깥 여백 기준의 외곽 크기 */
export function getBlockPaddedSize(pad: number) {
  return {
    width: BLOCK_FOOTPRINT_WIDTH + pad * 2,
    depth: BLOCK_FOOTPRINT_DEPTH + pad * 2,
  };
}

/** Block 바깥쪽으로 두께 t만큼 돌출되는 4변 프레임
 * 바깥 가장자리 = footprint ± (outset + thickness)
 */
export function getBlockOuterFrameSegments(
  origin: Vec3,
  y: number,
  thickness: number,
  height: number,
  /** Block 경계와 프레임 안쪽 가장자리 사이 간격 */
  outset = 0,
): BlockFrameSegment[] {
  const x0 = origin[0];
  const z0 = origin[2];
  const x1 = x0 + BLOCK_FOOTPRINT_WIDTH;
  const z1 = z0 + BLOCK_FOOTPRINT_DEPTH;
  const cx = x0 + BLOCK_FOOTPRINT_WIDTH / 2;
  const cz = z0 + BLOCK_FOOTPRINT_DEPTH / 2;
  const t = thickness;
  const o = outset;
  const outerPad = o + t;

  return [
    {
      position: [cx, y, z0 - o - t / 2],
      scale: [BLOCK_FOOTPRINT_WIDTH + outerPad * 2, height, t],
    },
    {
      position: [cx, y, z1 + o + t / 2],
      scale: [BLOCK_FOOTPRINT_WIDTH + outerPad * 2, height, t],
    },
    {
      position: [x0 - o - t / 2, y, cz],
      scale: [t, height, BLOCK_FOOTPRINT_DEPTH + outerPad * 2],
    },
    {
      position: [x1 + o + t / 2, y, cz],
      scale: [t, height, BLOCK_FOOTPRINT_DEPTH + outerPad * 2],
    },
  ];
}

export function buildBlockOutlinesGeometry(
  blocks: readonly BlockDefinition[],
  y: number,
) {
  const positions: number[] = [];

  for (const block of blocks) {
    const [a, b, c, d] = getBlockFootprintCorners(block.origin, y);
    positions.push(...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a);
  }

  return positions;
}
