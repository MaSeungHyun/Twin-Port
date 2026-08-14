import { BLOCKS, getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
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

export function computeBlockOccupancies(
  containers: Container[],
  blocks: readonly BlockDefinition[] = BLOCKS,
): BlockOccupancy[] {
  const counts = Object.fromEntries(blocks.map((b) => [b.code, 0])) as Record<
    string,
    number
  >;

  for (const container of containers) {
    if (container.status !== "stored") continue;
    const code = container.location.block;
    if (code in counts) counts[code] += 1;
  }

  return blocks.map((block) => {
    const occupied = counts[block.code] ?? 0;
    const capacity = getBlockSlotGrid(block).capacity;
    const ratio = capacity === 0 ? 0 : occupied / capacity;
    return {
      blockCode: block.code,
      occupied,
      capacity,
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

export function computeYardStatus(
  containers: Container[],
  blocks: readonly BlockDefinition[] = BLOCKS,
): YardStatus {
  const occupancies = computeBlockOccupancies(containers, blocks);
  const totalContainers = occupancies.reduce(
    (sum, item) => sum + item.occupied,
    0,
  );
  const totalCapacity = occupancies.reduce(
    (sum, item) => sum + item.capacity,
    0,
  );
  const ratio = totalCapacity === 0 ? 0 : totalContainers / totalCapacity;

  return {
    totalContainers,
    totalCapacity,
    emptySlots: totalCapacity - totalContainers,
    blockCount: blocks.length,
    occupancy: Math.round(ratio * 1000) / 10,
    dangerous: occupancies.filter((item) => item.ratio >= DANGEROUS_RATIO)
      .length,
  };
}
