import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { setCameraDragging } from "@/domain/hoverOutline";
import { ORBIT_MAX_DISTANCE } from "@/constants/camera";
import { useViewportStore } from "@/stores/viewport";
import { useEffect, type RefObject } from "react";

/** 우클릭(팬) 드래그가 이 픽셀을 넘으면 Tracking 해제 */
const PAN_CANCEL_PX = 4;
/** 카메라 드래그로 판정하는 이동 픽셀 (클릭 판정 event.delta > 4 와 맞춤) */
const DRAG_HOVER_SUPPRESS_PX = 4;
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type ControlsProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

/** monitorMode 구독을 이 컴포넌트에만 두어 Scene 전체 리렌더를 피함 */
export default function Controls({ controlsRef }: ControlsProps) {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const interactive = !monitorMode;
  const setEvents = useThree((s) => s.setEvents);

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

  // [hover] 카메라 드래그 중에는 R3F 포인터 raycast/hover 를 끈다.
  // 드래그 도중 오브젝트 위를 지나며 outline·툴팁·카드가 처음 뜰 때 파이프라인 컴파일/리렌더로 카메라가 끊기던 문제.
  // events.enabled=false 면 intersect 가 [] → 기존 hover 는 pointerout 으로 자연스럽게 해제됨.
  useEffect(() => {
    const el = controlsRef.current?.domElement as HTMLElement | undefined;
    if (!el) return;
    let down: { x: number; y: number } | null = null;
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!down || dragging || e.buttons === 0) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) <= DRAG_HOVER_SUPPRESS_PX) return;
      dragging = true;
      setCameraDragging(true);
      setEvents({ enabled: false });
    };
    const onUp = () => {
      down = null;
      if (!dragging) return;
      dragging = false;
      setCameraDragging(false);
      setEvents({ enabled: true });
    };
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (dragging) {
        setCameraDragging(false);
        setEvents({ enabled: true });
      }
    };
  }, [controlsRef, setEvents]);

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
