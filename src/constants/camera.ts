import { Euler, MathUtils, Quaternion, Vector3 } from "three";

/** BUSAN.glb CAMERA world — GLB 로드 전 Canvas 초기값 */
export const INITIAL_CAMERA_POSITION = new Vector3(11.829, 32.038, 42.3);
export const INITIAL_CAMERA_TARGET = new Vector3(0, 0, 0);

/** Blender CAMERA world quaternion (lookAt(0,0,0)과 ~2° 차이) */
export const INITIAL_CAMERA_QUATERNION = new Quaternion(
  -0.2987,
  0.1475,
  0.0468,
  0.9417,
);

/**
 * Blender FOV 표시 = horizontal(deg).
 * Three.js PerspectiveCamera.fov = vertical(deg).
 * 39.6° @ 16:9 ≈ 22.9° vertical — GLB yfov와 동일.
 */
export const BLENDER_CAMERA_FOV_HORIZONTAL = 39.6;

export function horizontalFovToVertical(
  horizontalDeg: number,
  aspect = 16 / 9,
): number {
  return MathUtils.radToDeg(
    2 * Math.atan(Math.tan(MathUtils.degToRad(horizontalDeg) / 2) / aspect),
  );
}

export const INITIAL_CAMERA_FOV = horizontalFovToVertical(
  BLENDER_CAMERA_FOV_HORIZONTAL,
);

/** @deprecated OrbitControls/quaternion 사용. degree 값을 radian Euler로 넣으면 안 맞음 */
export const INITIAL_CAMERA_ROTATION = new Euler(-36.53, 14.47, 10.49);

export const INITIAL_CAMERA_NEAR = 0.1;
export const INITIAL_CAMERA_FAR = 1000;

/** Block 점유율 / 관제모드 공통 — 위에서 내려다보는 시점 */
export const OCCUPANCY_CAMERA_POSITION = new Vector3(0, 26, -1);

export const OCCUPANCY_CAMERA_QUATERNION = new Quaternion(
  -0.5005234916311332,
  0.49947595865762223,
  0.4994754589933883,
  0.5005239923437959,
);

/** 관제모드 — occupancy 탑뷰와 동일 */
export const CONTROL_MODE_CAMERA_POSITION = OCCUPANCY_CAMERA_POSITION;
export const CONTROL_MODE_CAMERA_QUATERNION = OCCUPANCY_CAMERA_QUATERNION;

export const CAMERA_FLIGHT_DURATION = 1;

/** OrbitControls maxDistance */
export const ORBIT_MAX_DISTANCE = 70;

/**
 * 컨테이너 검색 포커스 — 카메라가 목표에서 얼마나 떨어져 볼지
 * - DISTANCE: 수평 거리 (클수록 멀리)
 * - HEIGHT: 목표 대비 카메라 높이
 */
/**
 * Ship / Container / Crane 트래킹 공통 — 대상으로부터 카메라까지 거리
 * (현재 시점 방향은 유지, OrbitControls pivot만 대상으로 이동)
 */
export const TRACKING_FOCUS_DISTANCE = 14;

/** 선박 tracking pivot — berth y 기준 추가 높이 (낮을수록 수선면 쪽) */
export const SHIP_TRACKING_TARGET_Y_OFFSET = 0.5;

/** position + quaternion → 지면(y=0) 교차점으로 lookAt 타겟 계산 */
export function cameraLookAtTarget(
  position: Vector3,
  quaternion: Quaternion,
): Vector3 {
  const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();
  if (Math.abs(forward.y) < 1e-5) {
    return position.clone().add(forward.multiplyScalar(100));
  }
  const t = -position.y / forward.y;
  return position.clone().add(forward.multiplyScalar(Math.max(t, 1)));
}
