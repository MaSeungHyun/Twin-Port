import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { button, useControls } from "./controls";

/** 카메라 패널: 화각/근·원평면 편집, 현재 위치/회전 확인·복사 */
export default function CameraPanel() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const c = useControls("Camera", {
    fov: { value: camera.fov, min: 10, max: 120, step: 1 },
    near: { value: camera.near, min: 0.01, max: 50, step: 0.01 },
    far: { value: camera.far, min: 1000, max: 200000, step: 100 },
    "현재 위치 복사 (position/quaternion)": button(() => {
      const t = JSON.stringify({ position: camera.position.toArray().map((v) => +v.toFixed(2)), quaternion: camera.quaternion.toArray().map((v) => +v.toFixed(5)) });
      console.info("[Camera]", t);
      void navigator.clipboard?.writeText(t).catch(() => undefined);
    }),
  });
  useEffect(() => {
    camera.fov = c.fov;
    camera.near = c.near;
    camera.far = c.far;
    camera.updateProjectionMatrix();
  }, [camera, c.fov, c.near, c.far]);
  return null;
}
