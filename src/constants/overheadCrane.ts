import { CONTAINER_D, CONTAINER_H } from "@/constants/container";

/**
 * Block 오버헤드(RTG) 크레인 크기 규칙 — GLB 실측 bbox 를 아래 목표 크기(월드 m)로 비균일 스케일.
 * 스팬(X)  = 블록 폭(sizeX) × SPAN_RATIO  (다리가 블록 바깥 통로에 서도록)
 * 높이(Y)  = tiers × CONTAINER_H + HEIGHT_CLEARANCE (최상단 컨테이너 위 여유)
 * 깊이(Z)  = CONTAINER_D × DEPTH_BAYS (레일 방향 다리 간격)
 */
export const OVERHEAD_CRANE_SPAN_RATIO = 1;
export const OVERHEAD_CRANE_HEIGHT_CLEARANCE = 4;
export const OVERHEAD_CRANE_DEPTH_BAYS = 1.4;
/** 블록 길이(sizeZ) 대비 왕복 끝 여유 비율 */
export const OVERHEAD_CRANE_TRAVEL_INSET = 0.08;
export const OVERHEAD_CRANE_CONTAINER_H = CONTAINER_H;
export const OVERHEAD_CRANE_CONTAINER_D = CONTAINER_D;
/** 레일 방향 왕복 각속도(rad/s) = BASE + (index % 7) × STEP. 이전 0.09 / 0.02 → 절반 */
export const OVERHEAD_CRANE_SPEED_BASE = 0.045;
export const OVERHEAD_CRANE_SPEED_STEP = 0.01;
