import { Euler, MathUtils, Quaternion, Vector3 } from "three";

/** BUSAN.glb CAMERA world — GLB 로드 전 Canvas 초기값 */
export const INITIAL_CAMERA_POSITION = new Vector3(747.187, 2006.981, 2607.505);
export const INITIAL_CAMERA_TARGET = new Vector3(6.1, -0.2, -42.59);

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

export const INITIAL_CAMERA_NEAR = 1;
export const INITIAL_CAMERA_FAR = 50000;

/** Block 점유율 / 관제모드 공통 — 위에서 내려다보는 시점 */
export const OCCUPANCY_CAMERA_POSITION = new Vector3(6.1, 1628.7, -105.24);

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
export const ORBIT_MAX_DISTANCE = 15000;

/**
 * 오빗 회전 세로 범위. 0 = 바로 위(탑뷰), PI/2 = 지평선.
 * 지평면 아래로 내려가지 않게 지평선 바로 위(약 1.15°)에서 멈춘다 → 한쪽 지평선~머리 위~반대쪽 지평선 180°
 */
export const ORBIT_MIN_POLAR_ANGLE = 0;
export const ORBIT_MAX_POLAR_ANGLE = Math.PI / 2 - 0.02;

const _horizonOffset = new Vector3();
/** 카메라 위치가 대상 기준 오빗 세로 범위를 벗어나면 같은 거리·방위각으로 범위 안에 넣는다 (지평면 아래 비행 목표 보정) */
export function clampOrbitPolar(position: Vector3, target: Vector3): Vector3 {
  const offset = _horizonOffset.copy(position).sub(target);
  const dist = offset.length();
  if (dist < 1e-6) return position;
  const phi = Math.acos(MathUtils.clamp(offset.y / dist, -1, 1));
  const clamped = MathUtils.clamp(phi, Math.max(ORBIT_MIN_POLAR_ANGLE, 1e-6), ORBIT_MAX_POLAR_ANGLE);
  if (clamped === phi) return position;
  const horizontal = Math.hypot(offset.x, offset.z);
  const theta = horizontal > 1e-9 ? Math.atan2(offset.x, offset.z) : 0;
  const r = dist * Math.sin(clamped);
  return position.set(target.x + r * Math.sin(theta), target.y + dist * Math.cos(clamped), target.z + r * Math.cos(theta));
}

/**
 * 컨테이너 검색 포커스 — 카메라가 목표에서 얼마나 떨어져 볼지
 * - DISTANCE: 수평 거리 (클수록 멀리)
 * - HEIGHT: 목표 대비 카메라 높이
 */
/**
 * Ship / Container / Crane 트래킹 공통 — 대상으로부터 카메라까지 거리
 * (현재 시점 방향은 유지, OrbitControls pivot만 대상으로 이동)
 */
export const TRACKING_FOCUS_DISTANCE = 480;

/** 컨테이너 tracking — 슬롯 근접 뷰 (Ship/Crane보다 가깝게) */
export const CONTAINER_TRACKING_FOCUS_DISTANCE = 240;

/** 안벽 크레인 tracking — 붐이 향하는 바다 쪽에서 머리까지 거리 / 머리보다 카메라가 더 높은 높이 */
export const CRANE_TRACKING_SEA_DISTANCE = TRACKING_FOCUS_DISTANCE;
export const CRANE_TRACKING_HEAD_LIFT = 120;

/** 선박 tracking pivot — berth y 기준 추가 높이 (낮을수록 수선면 쪽) */
export const SHIP_TRACKING_TARGET_Y_OFFSET = 31.325;

/** position + quaternion → 지면(y=0) 교차점으로 lookAt 타겟 계산 */
export function cameraLookAtTarget(
  position: Vector3,
  quaternion: Quaternion,
): Vector3 {
  const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();
  if (Math.abs(forward.y) < 1e-5) {
    return position.clone().add(forward.multiplyScalar(6000));
  }
  const t = -position.y / forward.y;
  return position.clone().add(forward.multiplyScalar(Math.max(t, 50)));
}
