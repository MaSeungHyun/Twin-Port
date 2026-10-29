import { OrbitControls } from "@react-three/drei";
import { ORBIT_MAX_DISTANCE } from "@/constants/camera";
import { useViewportStore } from "@/stores/viewport";
import { useEffect, type RefObject } from "react";

/** 우클릭(팬) 드래그가 이 픽셀을 넘으면 Tracking 해제 */
const PAN_CANCEL_PX = 4;
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type ControlsProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

/** monitorMode 구독을 이 컴포넌트에만 두어 Scene 전체 리렌더를 피함 */
export default function Controls({ controlsRef }: ControlsProps) {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const interactive = !monitorMode;

  // [pan] 우클릭 팬 시작 → Track 버튼 Tracking / 알람 follow 모두 해제
  useEffect(() => {
    const el = controlsRef.current?.domElement as HTMLElement | undefined;
    if (!el) return;
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = e.button === 2 ? { x: e.clientX, y: e.clientY } : null;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) <= PAN_CANCEL_PX) return;
      down = null;
      if (!useViewportStore.getState().monitorMode)
        useViewportStore.getState().cancelTrackingByPan();
    };
    const onUp = () => {
      down = null;
    };
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [controlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={interactive}
      enablePan={interactive}
      enableZoom={interactive}
      enableRotate={interactive}
      // maxPolarAngle={Math.PI * 0.475}
      enableDamping={false}
      maxDistance={ORBIT_MAX_DISTANCE}
    />
  );
}
