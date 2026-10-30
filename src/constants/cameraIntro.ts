/**
 * [camintro] Load-time camera = slot 1, "Monitoring Mode" (관제) on = smooth move to slot 2, off = back to slot 1.
 * Runtime order (intro/load + 관제 flight): these constants → browser-saved slot (tp_cam_slots) only if a constant is null → old behaviour.
 * Browser-saved slots still drive the manual 1-4 keys.
 * (slot 1: Home slot, then GLB view camera; slot 2: no camera move).
 * Paste the snippet from Camera Slots ▸ "현재 슬롯을 코드용으로 복사" here to lock them for every browser / deploy.
 */
export type CameraSlotValue = { p: [number, number, number]; t: [number, number, number] };

export const CAMERA_INTRO_ENABLED = true;
/** monitor-mode move duration (s), easeInOutCubic */
export const CAMERA_INTRO_DURATION = 1.8;

// placeholder: null = not locked yet (falls back to Home / GLB view camera)
export const CAMERA_INTRO_SLOT1: CameraSlotValue | null = { p: [118.766, 23.41, -108.594], t: [90.693, 24.728, -123.252] };
// placeholder: null = not locked yet (no move on monitor mode)
export const CAMERA_INTRO_SLOT2: CameraSlotValue | null = { p: [787.866, 1582.676, 1755.024], t: [162.967, -14.926, -36.442] };
/** window event fired by the '관제 시작' intro overlay → CameraSlots flies to slot 2 */
export const CAMERA_INTRO_START_EVENT = "tp:intro-start";

/** [pullback] 관제 시작 클릭 시에는 카메라를 움직이지 않고, 이 배(SHIP_TWEENS 0-based 인덱스, 라벨 "4 (008)" = 5번째 배)가 출항을 시작하면 slot 2로 서서히 빠짐 */
export const CAMERA_PULLBACK_SHIP_INDEX = 4;
/** 그 배 출항 시작 → 카메라가 빠지기 시작할 때까지 지연(초) */
export const CAMERA_PULLBACK_DELAY = 0;
/** 카메라가 slot 2까지 빠지는 시간(초), easeInOutCubic */
export const CAMERA_PULLBACK_DURATION = 8;
/** window event: ShipCargo → CameraSlots (지정 배 출항 시작) */
export const CAMERA_PULLBACK_EVENT = "tp:camera-pullback";
