import { ACESFilmicToneMapping, AgXToneMapping, Euler } from "three";

/**
 * Blender Color Management → Three.js
 * - View Transform: AgX / Look: None
 * - Exposure: 0  →  toneMappingExposure = 2^0 = 1
 * - Gamma: 1 / Display: sRGB
 */
export const TONE_MAPPING = ACESFilmicToneMapping;
export const TONE_MAPPING_EXPOSURE = 3.6;
// export const TONE_MAPPING_EXPOSURE = 2;

/**
 * World Background Strength = 1.
 * 하늘(배경) HDR 밝기. 메시 조명과 별개.
 */
export const ENVIRONMENT_BACKGROUND_INTENSITY = 0;

/**
 * 메시가 HDR Environment 조명을 받는 정도.
 * Blender Background Strength와 동일 (1).
 */
export const ENVIRONMENT_MESH_INTENSITY = 0.25;
// export const ENVIRONMENT_MESH_INTENSITY = 0.5;

/**
 * HDR Light Studio export: customrotation=90°, Mapping=(0,0,0).
 * Blender Z-up HDR을 Three.js Y-up에 맞추려면 yaw 90°가 기본.
 * 하늘과 메시 조명은 같은 월드를 쓰므로 회전을 공유한다.
 */

// ACESFilmicToneMapping;
// export const ENVIRONMENT_ROTATION = new Euler(-2.6005, 1.7279, 2.5831);
// export const ENVIRONMENT_ROTATION = new Euler(-2.35, 2.36, -2.1);
// export const ENVIRONMENT_ROTATION = new Euler(-2.85, 1.96, -3.1);
// export const ENVIRONMENT_ROTATION = new Euler(0.8552, 0.9425, 1.0821);
// export const ENVIRONMENT_ROTATION = new Euler(-Math.PI, 2.81, 2.7751);
// export const ENVIRONMENT_ROTATION = new Euler(-Math.PI, 3.0369, 2.7751);
// export const ENVIRONMENT_ROTATION = new Euler(-2.9147, 2.3038, 2.7751);
// export const ENVIRONMENT_ROTATION = new Euler(-2.9147, Math.PI, -3.0543);
// export const ENVIRONMENT_ROTATION = new Euler(-2.9496, Math.PI, -3.0892);
// export const ENVIRONMENT_ROTATION = new Euler(-3.0543, Math.PI, -3.0892);
// export const ENVIRONMENT_ROTATION = new Euler(-2.9671, -3.0369, -3.0892);
// export const ENVIRONMENT_ROTATION = new Euler(-3.0369, -Math.PI, Math.PI);
export const ENVIRONMENT_ROTATION = new Euler(-Math.PI, -Math.PI, Math.PI);
// AgXToneMapping
// export const ENVIRONMENT_ROTATION = new Euler(3.1067, -2.8274, Math.PI);
// export const ENVIRONMENT_ROTATION = new Euler(-3.002, -3.1067, 2.8274);
// export const ENVIRONMENT_ROTATION = new Euler(-2.9147, -Math.PI, 2.8274);
export const BACKGROUND_ROTATION = ENVIRONMENT_ROTATION;
