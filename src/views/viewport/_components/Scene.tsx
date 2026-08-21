import { Suspense, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, StatsGl } from "@react-three/drei";

import { FogExp2 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import Controls from "./Controls";
import Water from "./Water";
import Models from "./Models";
import SunLight from "./SunLight";
import CameraFlight from "./CameraFlight";
import OccupancyTransition from "./OccupancyTransition";

import skybox from "@/assets/image/sky.hdr";

import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
} from "@/constants/camera";
import { useViewportStore } from "@/stores/viewport";

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const pauseRender = monitorMode;

  return (
    <R3FCanvas
      className="h-full w-full touch-none"
      style={{ display: "block", overflow: "hidden", backgroundColor: "#000" }}
      shadows={{ enabled: true }}
      gl={{ antialias: true, alpha: false }}
      frameloop={pauseRender ? "never" : "always"}
      // scene={{ fog: new FogExp2(0x00000000, 0.0005) }}
      camera={{
        position: INITIAL_CAMERA_POSITION,
        quaternion: INITIAL_CAMERA_QUATERNION,
        fov: 35,
        near: 1,
        far: 20000,
      }}
    >
      {/* 로딩 UI는 App의 ViewLoader(React DOM)에서 처리 */}
      <Suspense fallback={null}>
        <Environment
          files={skybox}
          background
          backgroundBlurriness={0.2}
          backgroundIntensity={0.7}
          environmentIntensity={0.7}
        />
        <OccupancyTransition />
        <Controls controlsRef={controlsRef} />
        <CameraFlight controlsRef={controlsRef} />

        <ambientLight intensity={0.5} />
        <SunLight />
        <Water />
        <Models />

        {/* 월드 확인용 원점 축: X=빨강, Y=초록, Z=파랑 */}
        {/* <axesHelper args={[100]} /> */}
        {/* <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
          <GizmoViewport
            axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
            labelColor="white"
          />
        </GizmoHelper> */}
      </Suspense>
      {import.meta.env.DEV && <StatsGl className="absolute top-16 right-2" />}
    </R3FCanvas>
  );
}
