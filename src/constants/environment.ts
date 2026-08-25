import { Euler } from "three";

/** 하늘(배경) HDR 밝기. 메시 조명과 별개 */
export const ENVIRONMENT_BACKGROUND_INTENSITY = 0;

/**
 * 메시가 HDR Environment 조명을 받는 정도.
 * 0이면 환경 반사/환경광 없음, 1이 Three 기본값.
 */
export const ENVIRONMENT_MESH_INTENSITY = 0.4;

export const ENVIRONMENT_ROTATION = new Euler(
  Math.PI / 3,
  Math.PI / 2.5,
  Math.PI / -2.7,
);
export const BACKGROUND_ROTATION = new Euler(0, Math.PI / 2, 0);
