import { BLOCKS, SLOT_MAX_SIZE } from "@/constants/block";
import type { Container } from "@/types/container";

export type BlockOccupancy = {
  blockCode: string;
  occupied: number;
  capacity: number;
  /** 0~1 */
  ratio: number;
  /** 0~100 */
  percent: number;
};

const BLOCK_CAPACITY =
  SLOT_MAX_SIZE.bays * SLOT_MAX_SIZE.rows * SLOT_MAX_SIZE.tiers;

export function computeBlockOccupancies(
  containers: Container[],
): BlockOccupancy[] {
  const counts = Object.fromEntries(BLOCKS.map((b) => [b.code, 0])) as Record<
    string,
    number
  >;

  for (const container of containers) {
    if (container.status !== "stored") continue;
    const code = container.location.block;
    if (code in counts) counts[code] += 1;
  }

  return BLOCKS.map((block) => {
    const occupied = counts[block.code] ?? 0;
    const ratio = BLOCK_CAPACITY === 0 ? 0 : occupied / BLOCK_CAPACITY;
    return {
      blockCode: block.code,
      occupied,
      capacity: BLOCK_CAPACITY,
      ratio,
      percent: Math.round(ratio * 1000) / 10,
    };
  });
}

export type YardStatusKey =
  | "totalContainers"
  | "totalCapacity"
  | "emptySlots"
  | "blockCount"
  | "occupancy"
  | "dangerous";

export type YardStatus = Record<YardStatusKey, number>;

const DANGEROUS_RATIO = 0.8;

export { DANGEROUS_RATIO };

/** 점유율 구간별 표시 색 (바닥 마크·패널 공통) */
export function occupancyColor(ratio: number): string {
  if (ratio < 0.6) return "#22c55e";
  if (ratio < 0.8) return "#eab308";
  return "#ef2444";
}

export function computeYardStatus(containers: Container[]): YardStatus {
  const occupancies = computeBlockOccupancies(containers);
  const totalContainers = occupancies.reduce(
    (sum, item) => sum + item.occupied,
    0,
  );
  const totalCapacity = BLOCKS.length * BLOCK_CAPACITY;
  const ratio = totalCapacity === 0 ? 0 : totalContainers / totalCapacity;

  return {
    totalContainers,
    totalCapacity,
    emptySlots: totalCapacity - totalContainers,
    blockCount: BLOCKS.length,
    occupancy: Math.round(ratio * 1000) / 10,
    dangerous: occupancies.filter((item) => item.ratio >= DANGEROUS_RATIO)
      .length,
  };
}
