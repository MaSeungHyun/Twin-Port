import { SLOT_MAX_SIZE } from "@/constants/block";
import { CONTAINER_H, DECK_Y } from "@/constants/container";
import { getBlockPaddedSize } from "@/domain/blockFootprint";

/** 바닥 색·외곽 라인 — 크기는 블록 footprint에 비례 */
export const BLOCK_MARK = {
  pad: 0,
  borderThickness: 0.501,
  borderHeight: 0.313,
  floorHeight: 0.251,
} as const;

export const BORDER_Y = DECK_Y + BLOCK_MARK.borderHeight / 2 + 0.251;
export const FLOOR_Y = DECK_Y + BLOCK_MARK.floorHeight / 2 + 0.125;
export const LABEL_Y = DECK_Y + 1.002;
export const BORDER_OUTSET = BLOCK_MARK.pad - BLOCK_MARK.borderThickness;
export const PADDED_SIZE = getBlockPaddedSize(BLOCK_MARK.pad);
export const HIT_HEIGHT = SLOT_MAX_SIZE.tiers * CONTAINER_H * 3;

/** 카메라 거리 기준 — 이 거리에서 scale 1 */
export const BLOCK_LABEL_REF_DISTANCE = 3445.75;
export const BLOCK_LABEL_MIN_SCALE = 1;
export const BLOCK_LABEL_MAX_SCALE = 3.5;

export { occupancyColor } from "@/domain/occupancy";
