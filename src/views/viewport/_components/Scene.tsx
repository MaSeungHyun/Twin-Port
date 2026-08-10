import { Suspense, useRef } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, StatsGl } from "@react-three/drei";

import { FogExp2, PCFShadowMap } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import Controls from "./Controls";
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
      shadows={{ enabled: true }}
      gl={{ antialias: true }}
      scene={{ fog: new FogExp2(0x00000000, 0.0005) }}
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
          environmentIntensity={0.7}
        />
        <Controls controlsRef={controlsRef} />
        <CameraFlight controlsRef={controlsRef} />

        <ambientLight intensity={0.5} />
        <SunLight />
        <Water />
        <Models />
      </Suspense>
      {import.meta.env.DEV && <StatsGl className="absolute top-16 right-2" />}
    </R3FCanvas>
  );
}
