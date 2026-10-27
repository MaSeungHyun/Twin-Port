import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/** [debug] ?cam=x,y,z,tx,ty,tz 로 카메라 고정 (스크린샷/재현용, 마운트 후 120프레임 동안 적용) */
const CAM = (() => {
  if (typeof location === "undefined") return null;
  const v = new URLSearchParams(location.search).get("cam")?.split(",").map(Number);
  return v && v.length === 6 && v.every(Number.isFinite) ? v : null;
})();

export default function CamParam() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const n = useRef(0);
  useFrame(() => {
    if (!CAM || n.current++ > 120) return;
    camera.position.set(CAM[0]!, CAM[1]!, CAM[2]!);
    controls?.target.set(CAM[3]!, CAM[4]!, CAM[5]!);
    camera.lookAt(CAM[3]!, CAM[4]!, CAM[5]!);
    controls?.update();
  });
  return null;
}
