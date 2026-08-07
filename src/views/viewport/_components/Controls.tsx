import { OrbitControls } from "@react-three/drei";
import { ORBIT_MAX_DISTANCE } from "@/constants/camera";
import { useViewportStore } from "@/stores/viewport";
import type { RefObject } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type ControlsProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

/** monitorMode 구독을 이 컴포넌트에만 두어 Scene 전체 리렌더를 피함 */
export default function Controls({ controlsRef }: ControlsProps) {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const interactive = !monitorMode;

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={interactive}
      enablePan={interactive}
      enableZoom={interactive}
      enableRotate={interactive}
      maxPolarAngle={Math.PI * 0.475}
      enableDamping={false}
      maxDistance={ORBIT_MAX_DISTANCE}
    />
  );
}
