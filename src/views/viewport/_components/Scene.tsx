import { memo, Suspense, useMemo, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, StatsGl } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Controls from "./Controls";
import Models from "./Models";
import SunLight from "./SunLight";
import OccupancyTransition from "./OccupancyTransition";

// 모니터링 모드일 때, Scene의 렌더링을 멈추고 싶을 때 적용
// 성능 향상이나 현재 60fps로 잘 나오므로 우선 제거
// import MonitorFrameLoopGate from "./MonitorFrameLoopGate";

import skybox from "@/assets/image/port_hdr.hdr";

import {
  ENVIRONMENT_BACKGROUND_INTENSITY,
  ENVIRONMENT_MESH_INTENSITY,
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

import {
  environmentRotationRad,
  useEnvironmentDebugStore,
} from "@/stores/environmentDebug";

import { SRGBColorSpace, VSMShadowMap } from "three";

// import EnvironmentRotationPanel from "./EnvironmentRotationPanel";

const initialCamera = {
  position: INITIAL_CAMERA_POSITION,
  quaternion: INITIAL_CAMERA_QUATERNION,
  fov: INITIAL_CAMERA_FOV,
  near: INITIAL_CAMERA_NEAR,
  far: INITIAL_CAMERA_FAR,
} as const;

function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const rotationDeg = useEnvironmentDebugStore((s) => s.rotationDeg);
  const environmentRotation = useMemo(
    () => environmentRotationRad(rotationDeg),
    [rotationDeg],
  );

  return (
    <div className="relative h-full w-full">
      {/* {import.meta.env.DEV && <EnvironmentRotationPanel />} */}
      <R3FCanvas
        className="h-full w-full touch-none"
        style={{
          display: "block",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
        shadows={{ type: VSMShadowMap }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: TONE_MAPPING,
          toneMappingExposure: TONE_MAPPING_EXPOSURE,
          outputColorSpace: SRGBColorSpace,
        }}
        frameloop="always"
        camera={initialCamera}
      >
        {/* <MonitorFrameLoopGate /> */}
        {/* 로딩 UI는 App의 ViewLoader(React DOM)에서 처리 */}
        {/* <fogExp2 attach="fog" args={["#000000", OCCUPANCY_TRANSITION.fogFrom]} /> */}
        <Suspense fallback={null}>
          <Environment
            files={skybox}
            background
            blur={0}
            backgroundRotation={environmentRotation}
            backgroundBlurriness={0}
            backgroundIntensity={ENVIRONMENT_BACKGROUND_INTENSITY}
            environmentRotation={environmentRotation}
            environmentIntensity={ENVIRONMENT_MESH_INTENSITY}
          />
          <OccupancyTransition />
          <Controls controlsRef={controlsRef} />
          {/* <CameraFlight controlsRef={controlsRef} /> */}
          {/* <ambientLight color={0xacaccc} intensity={0.2} /> */}
          <SunLight />
          {/* <directionalLight
            color={0xffffff}
            intensity={1}
            position={[0, 5, -0]}
            castShadow
          >
            <Helper type={DirectionalLightHelper} args={[3]} />
          </directionalLight> */}
          {/* <Water /> */}
          <Models />
        </Suspense>

        {import.meta.env.DEV && <StatsGl className="absolute top-24 right-4" />}
      </R3FCanvas>
    </div>
  );
}

export default memo(Scene);
