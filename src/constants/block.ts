import type { Vec3 } from "./geometry";

/** 실제 야드에 가까운 Block 용량: Bay20 × Row6 × Tier4 */
export const SLOT_MAX_SIZE = {
  bays: 20,
  rows: 6,
  tiers: 4,
} as const;

export type BlockDefinition = {
  code: string;
  name: string;
  /** Block 로컬 원점 (월드). Bay↑Z, Row↑X */
  origin: Vec3;
};

/**
 * Block footprint ≈ Bay20×2.42(~48) × Row6×0.98(~6)
 * 6열 × 4행 = 24 Blocks
 *
 * 번호는 화면 좌측(X+) 열부터 세로(Z)로 채움 — X·Z 모두 반전:
 *   B21 B17 B13 B09 B05 B01
 *   B22 B18 B14 B10 B06 B02
 *   B23 B19 B15 B11 B07 B03
 *   B24 B20 B16 B12 B08 B04
 */
const COL_X = [-50, -34, -18, -2, 14, 30] as const;
const ROW_Z = [-92, -36, 20, 76] as const;

export const BLOCKS: readonly BlockDefinition[] = COL_X.flatMap((x, col) =>
  ROW_Z.map((z, row) => {
    const colIndex = COL_X.length - 1 - col;
    const rowIndex = ROW_Z.length - 1 - row;
    const index = colIndex * ROW_Z.length + rowIndex + 1;
    return {
      code: `B${String(index).padStart(2, "0")}`,
      name: `Block ${index}`,
      origin: [x, 0, z] as Vec3,
    };
  }),
);

export const BLOCK_BY_CODE = Object.fromEntries(
  BLOCKS.map((block) => [block.code, block]),
) as Record<string, BlockDefinition>;
