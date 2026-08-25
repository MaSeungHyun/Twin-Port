import { Suspense, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, StatsGl } from "@react-three/drei";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import Controls from "./Controls";
import Models from "./Models";
import SunLight from "./SunLight";
import OccupancyTransition from "./OccupancyTransition";

import skybox from "@/assets/image/port_hdr.hdr";

import {
  BACKGROUND_ROTATION,
  ENVIRONMENT_BACKGROUND_INTENSITY,
  ENVIRONMENT_MESH_INTENSITY,
  ENVIRONMENT_ROTATION,
  TONE_MAPPING,
  TONE_MAPPING_EXPOSURE,
} from "@/constants/environment";
import {
  INITIAL_CAMERA_FAR,
  INITIAL_CAMERA_FOV,
  INITIAL_CAMERA_NEAR,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
} from "@/constants/camera";

import { useViewportStore } from "@/stores/viewport";
import { SRGBColorSpace } from "three";

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const pauseRender = monitorMode;

  return (
    <R3FCanvas
      className="h-full w-full touch-none"
      style={{ display: "block", overflow: "hidden", backgroundColor: "#000" }}
      shadows={{ enabled: true }}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: TONE_MAPPING,
        toneMappingExposure: TONE_MAPPING_EXPOSURE,
        outputColorSpace: SRGBColorSpace,
      }}
      frameloop={pauseRender ? "never" : "always"}
      camera={{
        position: INITIAL_CAMERA_POSITION,
        quaternion: INITIAL_CAMERA_QUATERNION,
        fov: INITIAL_CAMERA_FOV,
        near: INITIAL_CAMERA_NEAR,
        far: INITIAL_CAMERA_FAR,
      }}
    >
      {/* 로딩 UI는 App의 ViewLoader(React DOM)에서 처리 */}
      {/* <fogExp2 attach="fog" args={["#000000", OCCUPANCY_TRANSITION.fogFrom]} /> */}
      <Suspense fallback={null}>
        <Environment
          files={skybox}
          background
          blur={0}
          backgroundRotation={BACKGROUND_ROTATION}
          backgroundBlurriness={0}
          backgroundIntensity={ENVIRONMENT_BACKGROUND_INTENSITY}
          environmentRotation={ENVIRONMENT_ROTATION}
          environmentIntensity={ENVIRONMENT_MESH_INTENSITY}
        />
        <OccupancyTransition />
        <Controls controlsRef={controlsRef} />
        {/* <CameraFlight controlsRef={controlsRef} /> */}

        {/* <ambientLight color={0xacaccc} intensity={0.2} /> */}
        <SunLight />
        {/* <Water /> */}
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
