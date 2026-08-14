import {
  getBlockSlotGrid,
  SLOT_MAX_SIZE,
  type BlockDefinition,
} from "@/constants/block";
import { CONTAINER_D, CONTAINER_W } from "@/constants/container";
import type { Vec3 } from "@/constants/geometry";

/** Block 야드 footprint (Row=X, Bay=Z) — 기본 격자 */
export const BLOCK_FOOTPRINT_WIDTH = SLOT_MAX_SIZE.rows * CONTAINER_W;
export const BLOCK_FOOTPRINT_DEPTH = SLOT_MAX_SIZE.bays * CONTAINER_D;

export function getBlockFootprintSize(block: BlockDefinition) {
  const grid = getBlockSlotGrid(block);
  return {
    width: grid.sizeX,
    depth: grid.sizeZ,
  };
}

export function getBlockFootprintCenter(block: BlockDefinition): Vec3 {
  const { width, depth } = getBlockFootprintSize(block);
  const yaw = block.yaw ?? 0;
  const lx = width / 2;
  const lz = depth / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    block.origin[0] + lx * c + lz * s,
    block.origin[1],
    block.origin[2] + -lx * s + lz * c,
  ];
}

export function getBlockFootprintCorners(block: BlockDefinition, y: number) {
  const { width, depth } = getBlockFootprintSize(block);
  const x0 = block.origin[0];
  const z0 = block.origin[2];
  const x1 = x0 + width;
  const z1 = z0 + depth;

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
  yaw: number;
};

function localToWorld(
  origin: Vec3,
  yaw: number,
  lx: number,
  y: number,
  lz: number,
): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [origin[0] + lx * c + lz * s, y, origin[2] + -lx * s + lz * c];
}

export function getBlockMarkThickness(block: BlockDefinition) {
  const { width, depth } = getBlockFootprintSize(block);
  const minSide = Math.min(width, depth);
  return Math.min(Math.max(minSide * 0.02, 0.012), 0.07);
}

export function getBlockLabelSize(block: BlockDefinition) {
  const { width, depth } = getBlockFootprintSize(block);
  const minSide = Math.min(width, depth);
  return Math.min(Math.max(minSide * 3.16, 0.11), 0.9);
}

/** 바닥·라인 공통 바깥 여백 기준의 외곽 크기 */
export function getBlockPaddedSize(
  pad: number,
  width = BLOCK_FOOTPRINT_WIDTH,
  depth = BLOCK_FOOTPRINT_DEPTH,
) {
  return {
    width: width + pad * 2,
    depth: depth + pad * 2,
  };
}

/** Block 메시 가장자리에 붙는 4변 프레임 (yaw 반영) */
export function getBlockOuterFrameSegments(
  block: BlockDefinition,
  y: number,
  thickness?: number,
  height = 0.03,
  outset = 0,
): BlockFrameSegment[] {
  const { width, depth } = getBlockFootprintSize(block);
  const yaw = block.yaw ?? 0;
  const t = thickness ?? getBlockMarkThickness(block);
  const o = outset;

  return [
    {
      position: localToWorld(block.origin, yaw, width / 2, y, -o - t / 2),
      scale: [width + t, height, t],
      yaw,
    },
    {
      position: localToWorld(
        block.origin,
        yaw,
        width / 2,
        y,
        depth + o + t / 2,
      ),
      scale: [width + t, height, t],
      yaw,
    },
    {
      position: localToWorld(block.origin, yaw, -o - t / 2, y, depth / 2),
      scale: [t, height, depth],
      yaw,
    },
    {
      position: localToWorld(
        block.origin,
        yaw,
        width + o + t / 2,
        y,
        depth / 2,
      ),
      scale: [t, height, depth],
      yaw,
    },
  ];
}

export function buildBlockOutlinesGeometry(
  blocks: readonly BlockDefinition[],
  y: number,
) {
  const positions: number[] = [];

  for (const block of blocks) {
    const [a, b, c, d] = getBlockFootprintCorners(block, y);
    positions.push(...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a);
  }

  return positions;
}
