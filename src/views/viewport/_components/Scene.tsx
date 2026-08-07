import { Suspense, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, OrbitControls, StatsGl } from "@react-three/drei";

import { FogExp2, PCFShadowMap } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import Water from "./Water";
import Models from "./Models";
import SunLight from "./SunLight";
import CameraFlight from "./CameraFlight";

import skybox from "@/assets/image/sky.hdr";

import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
} from "@/constants/camera";

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <R3FCanvas
      className="relative inset-0 h-full w-full touch-none"
      style={{ display: "block", overflow: "hidden" }}
      shadows={{ type: PCFShadowMap, enabled: true }}
      gl={{ antialias: false }}
      scene={{ fog: new FogExp2(0x00000000, 0.0001) }}
      camera={{
        position: INITIAL_CAMERA_POSITION,
        quaternion: INITIAL_CAMERA_QUATERNION,
        fov: 35,
        near: 1,
        far: 20000,
      }}
    >
      <Suspense fallback={null}>
        <Environment
          files={skybox}
          background
          backgroundBlurriness={0.2}
          backgroundIntensity={0.7}
          environmentIntensity={1}
        />
        <OrbitControls
          ref={controlsRef}
          maxPolarAngle={Math.PI * 0.475}
          enableDamping={false}
          maxDistance={240}
        />
        <CameraFlight controlsRef={controlsRef} />

        <ambientLight intensity={0.5} />
        <SunLight />
        <Water />
        <Models />
      </Suspense>
      {import.meta.env.DEV && (
        <StatsGl clearStatsGlStyle={true} className="relative top-2 right-2" />
      )}
    </R3FCanvas>
  );
}
