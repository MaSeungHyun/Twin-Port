import type { BlockDefinition } from "@/constants/block";
import { getBlockSlotGrid } from "@/constants/block";
import { CONTAINER_COMPANIES, MAX_PER_COLOR } from "@/constants/container";
import type { Container } from "@/types/container";

const MAX_TOTAL = MAX_PER_COLOR * 4;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

function hash2(a: number, b: number) {
  return ((a * 73856093) ^ (b * 19349663)) >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 블록별 목표 점유율. 거의 비움 ~ 거의 가득까지 넓게 분포. */
function pickTargetFill(random: () => number) {
  const r = random();
  if (r < 0.1) return 0.04 + random() * 0.08;
  if (r < 0.22) return 0.14 + random() * 0.1;
  if (r < 0.4) return 0.28 + random() * 0.12;
  if (r < 0.58) return 0.45 + random() * 0.12;
  if (r < 0.76) return 0.62 + random() * 0.1;
  if (r < 0.9) return 0.76 + random() * 0.1;
  return 0.88 + random() * 0.1;
}

/**
 * 스택 높이. 블록 목표 점유율에 맞추고, 위단은 들쭉날쭉하게 비운다.
 * 공중 부유 없이 1단부터 연속으로만 쌓는다.
 */
function sampleStackHeight(
  random: () => number,
  maxTiers: number,
  targetFill: number,
  row: number,
  bay: number,
  blockSalt: number,
): number {
  if (random() > targetFill * 1.25 && random() < 0.55) return 0;

  const mean = targetFill * maxTiers;
  const wave =
    Math.sin(row * 1.31 + bay * 0.73 + blockSalt * 0.017) * (0.35 + targetFill);
  const jitter = (random() - 0.5) * (1.1 + (1 - targetFill));
  return Math.round(clamp(mean + wave + jitter, 0, maxTiers));
}

/** BLOCK 메시 격자 안에 안정적인 mock 적재. 블록마다 적재량이 크게 다르다. */
export function generateYardContainers(
  blocks: readonly BlockDefinition[],
  seed = 20260814,
): Container[] {
  const random = mulberry32(seed);
  const containers: Container[] = [];
  let index = 1;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]!;
    const grid = getBlockSlotGrid(block);
    const blockSalt = hash2(blockIndex + 1, seed);
    const targetFill = pickTargetFill(random);

    for (let bay = 1; bay <= grid.bays; bay += 1) {
      for (let row = 1; row <= grid.rows; row += 1) {
        const height = sampleStackHeight(
          random,
          grid.tiers,
          targetFill,
          row,
          bay,
          blockSalt,
        );

        for (let tier = 1; tier <= height; tier += 1) {
          if (containers.length >= MAX_TOTAL) return containers;

          const company =
            CONTAINER_COMPANIES[
              Math.floor(random() * CONTAINER_COMPANIES.length)
            ]!;
          containers.push({
            id: `CONT-${pad(index, 5)}`,
            company,
            status: "stored",
            location: {
              block: block.code,
              slot: {
                bay: pad(bay, 3),
                row: pad(row, 2),
                tier: pad(tier, 2),
              },
            },
            destination: "",
          });
          index += 1;
        }
      }
    }
  }

  return containers;
}
