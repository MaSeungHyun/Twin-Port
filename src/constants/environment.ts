import { ACESFilmicToneMapping, Euler } from "three";

/**
 * Blender Color Management → Three.js
 * - View Transform: AgX / Look: None
 * - Exposure: 0  →  toneMappingExposure = 2^0 = 1
 * - Gamma: 1 / Display: sRGB
 */
export const TONE_MAPPING = ACESFilmicToneMapping;
export const TONE_MAPPING_EXPOSURE = 5;

/**
 * World Background Strength = 1.
 * 하늘(배경) HDR 밝기. 메시 조명과 별개.
 */
export const ENVIRONMENT_BACKGROUND_INTENSITY = 0;

/**
 * 메시가 HDR Environment 조명을 받는 정도.
 * Blender Background Strength와 동일 (1).
 */
export const ENVIRONMENT_MESH_INTENSITY = 0.12;

/**
 * HDR Light Studio export: customrotation=90°, Mapping=(0,0,0).
 * Blender Z-up HDR을 Three.js Y-up에 맞추려면 yaw 90°가 기본.
 * 하늘과 메시 조명은 같은 월드를 쓰므로 회전을 공유한다.
 */

export const ENVIRONMENT_ROTATION = new Euler(
  Math.PI / 2.55,
  Math.PI / 2.36,
  Math.PI / -2.1,
);
//  Math.PI / 2.85,
//   Math.PI / 1.96,
//   Math.PI / -3.1,
export const BACKGROUND_ROTATION = ENVIRONMENT_ROTATION;
