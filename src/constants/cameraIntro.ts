/**
 * [camintro] Load-time camera = slot 1, "Monitoring Mode" (관제) on = smooth move to slot 2, off = back to slot 1.
 * Runtime order: browser-saved slot (cookie/localStorage tp_cam_slots, Shift+1 / Shift+2) → these constants → old behaviour
 * (slot 1: Home slot, then GLB view camera; slot 2: no camera move).
 * Paste the snippet from Camera Slots ▸ "현재 슬롯을 코드용으로 복사" here to lock them for every browser / deploy.
 */
export type CameraSlotValue = { p: [number, number, number]; t: [number, number, number] };

export const CAMERA_INTRO_ENABLED = true;
/** monitor-mode move duration (s), easeInOutCubic */
export const CAMERA_INTRO_DURATION = 1.8;

// placeholder: null = not locked yet (falls back to Home / GLB view camera)
export const CAMERA_INTRO_SLOT1: CameraSlotValue | null = null;
// placeholder: null = not locked yet (no move on monitor mode)
export const CAMERA_INTRO_SLOT2: CameraSlotValue | null = null;
/** window event fired by the '관제 시작' intro overlay → CameraSlots flies to slot 2 */
export const CAMERA_INTRO_START_EVENT = "tp:intro-start";
