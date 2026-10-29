import {
  BLOCKS,
  getBlockSlotGrid,
  type BlockDefinition,
} from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import type { Vec3 } from "@/constants/geometry";
import {
  OVERHEAD_CRANE_CONTAINER_D,
  OVERHEAD_CRANE_CONTAINER_H,
  OVERHEAD_CRANE_DEPTH_BAYS,
  OVERHEAD_CRANE_HEIGHT_CLEARANCE,
  OVERHEAD_CRANE_SPAN_RATIO,
  OVERHEAD_CRANE_SPEED_BASE,
  OVERHEAD_CRANE_SPEED_STEP,
  OVERHEAD_CRANE_TRAVEL_INSET,
} from "@/constants/overheadCrane";

export type OverHeadCraneInstance = {
  /** 기준 위치 (레일 중간, Y 고정) */
  position: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  /** 목표 월드 크기 [스팬, 높이, 깊이] (m). 있으면 GLB bbox 기준 비균일 스케일로 맞춤 (scale 무시) */
  fit?: Vec3;
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
    const inset = length * OVERHEAD_CRANE_TRAVEL_INSET;
    const yaw = block.yaw ?? 0;
    const y = deckY + block.origin[1];
    const fit: Vec3 = [
      width * OVERHEAD_CRANE_SPAN_RATIO,
      grid.tiers * OVERHEAD_CRANE_CONTAINER_H + OVERHEAD_CRANE_HEIGHT_CLEARANCE,
      OVERHEAD_CRANE_CONTAINER_D * OVERHEAD_CRANE_DEPTH_BAYS,
    ];
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
      fit,
      start,
      end,
      speed: OVERHEAD_CRANE_SPEED_BASE + (index % 7) * OVERHEAD_CRANE_SPEED_STEP,
      phase: index * 0.85,
    };
  });
}

/** [ohc] 매 프레임 갱신되는 live 위치 — 카메라 Tracking 용 (React state 없음) */
const livePositions: [number, number, number][] = [];

export function setOverheadCraneLivePosition(
  index: number,
  x: number,
  y: number,
  z: number,
) {
  const current = livePositions[index];
  if (current) {
    current[0] = x;
    current[1] = y;
    current[2] = z;
    return;
  }
  livePositions[index] = [x, y, z];
}

export function getOverheadCraneLivePosition(index: number): Vec3 | null {
  return livePositions[index] ?? null;
}
