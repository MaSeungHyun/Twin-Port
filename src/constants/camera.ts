import { Quaternion, Vector3 } from "three";

export const INITIAL_CAMERA_POSITION = new Vector3(
  89.56326109456616,
  24.434917598888408,
  -62.009178821423006,
);

export const INITIAL_CAMERA_QUATERNION = new Quaternion(
  -0.05394339144900211,
  0.8845824548563607,
  0.10580112815617389,
  0.45101010228170624,
);

/** Block 점유율 / 관제모드 공통 — 위에서 내려다보는 시점 */
export const OCCUPANCY_CAMERA_POSITION = new Vector3(0, 200, 16.84767483354515);

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
export const ORBIT_MAX_DISTANCE = 280;

/**
 * 컨테이너 검색 포커스 — 카메라가 목표에서 얼마나 떨어져 볼지
 * - DISTANCE: 수평 거리 (클수록 멀리)
 * - HEIGHT: 목표 대비 카메라 높이
 */
export const CONTAINER_FOCUS_DISTANCE = 56;
export const CONTAINER_FOCUS_HEIGHT = 28;

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
