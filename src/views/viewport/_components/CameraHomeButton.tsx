import IconButton from "@/components/IconButton";
import { CAMERA_HOME_EVENT } from "@/constants/cameraIntro";

/** R키와 동일 — 카메라를 원경(intro slot 2)으로 보낸다 */
export default function CameraHomeButton() {
  return (
    <IconButton
      icon="ScanSquare"
      label="멀리 보기 (R)"
      aria-label="멀리 보기"
      className="pointer-events-auto absolute right-4 bottom-4 z-20 flex size-12 cursor-pointer items-center justify-center rounded-md border-2 border-white/60 bg-[#00000080] text-white shadow-lg transition-all duration-200 hover:scale-105 hover:border-primary hover:bg-primary/80 hover:text-black active:scale-100 "
      onClick={() => window.dispatchEvent(new CustomEvent(CAMERA_HOME_EVENT))}
    />
  );
}
