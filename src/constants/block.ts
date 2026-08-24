import { CONTAINER_D, CONTAINER_W } from "./container";
import type { Vec3 } from "./geometry";

/** 실제 야드에 가까운 Block 용량: Bay20 × Row6 × Tier4 */
export const SLOT_MAX_SIZE = {
  bays: 20,
  rows: 6,
  tiers: 4,
} as const;

/** Row 방향 블록 폭 (X) */
export const BLOCK_SIZE_X = SLOT_MAX_SIZE.rows * CONTAINER_W;
/** Bay 방향 블록 깊이 (Z) */
export const BLOCK_SIZE_Z = SLOT_MAX_SIZE.bays * CONTAINER_D;
/** 통로 = 블록 폭 × 2 (텍스처 2칸) */
export const BLOCK_AISLE = BLOCK_SIZE_X * 2;
export const BLOCK_PITCH_X = BLOCK_SIZE_X + BLOCK_AISLE;
export const BLOCK_PITCH_Z = BLOCK_SIZE_Z + BLOCK_AISLE;

export type BlockDefinition = {
  code: string;
  name: string;
  /** Block 로컬 원점 (월드). Bay↑Z, Row↑X */
  origin: Vec3;
  /** 컨테이너 장축(Bay) 방향. 모델 블록 yaw */
  yaw?: number;
  /** 메시 footprint (Row=X, Bay=Z) */
  sizeX?: number;
  sizeZ?: number;
  rows?: number;
  bays?: number;
  tiers?: number;
  rowPitch?: number;
  bayPitch?: number;
  /** 격자 여백 (로컬 X/Z). 컨테이너를 블록 안에 가운데 정렬 */
  padX?: number;
  padZ?: number;
};

export function getBlockSlotGrid(block: BlockDefinition) {
  const sizeX = block.sizeX ?? BLOCK_SIZE_X;
  const sizeZ = block.sizeZ ?? BLOCK_SIZE_Z;
  const rows = block.rows ?? SLOT_MAX_SIZE.rows;
  const bays = block.bays ?? SLOT_MAX_SIZE.bays;
  const tiers = block.tiers ?? SLOT_MAX_SIZE.tiers;
  return {
    sizeX,
    sizeZ,
    rows,
    bays,
    tiers,
    rowPitch: block.rowPitch ?? CONTAINER_W,
    bayPitch: block.bayPitch ?? CONTAINER_D,
    padX: block.padX ?? 0,
    padZ: block.padZ ?? 0,
    capacity: rows * bays * tiers,
  };
}

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
/** CONTAINER_YARD_OFFSET.x — 월드 대칭을 위해 origin에서 미리 뺌 */
const YARD_OFFSET_X = 1;
const COL_COUNT = 6;
const ROW_COUNT = 4;
const COL_ORIGIN_X =
  -((COL_COUNT - 1) * BLOCK_PITCH_X + BLOCK_SIZE_X) / 2 - YARD_OFFSET_X;
const ROW_ORIGIN_Z = -18.4;
const COL_X = Array.from(
  { length: COL_COUNT },
  (_, i) => COL_ORIGIN_X + i * BLOCK_PITCH_X,
);
const ROW_Z = Array.from(
  { length: ROW_COUNT },
  (_, i) => ROW_ORIGIN_Z + i * BLOCK_PITCH_Z,
);

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
