import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, OrbitControls, StatsGl } from "@react-three/drei";
import { Suspense } from "react";
import skybox from "@/assets/image/sky.hdr";
import Water from "./Water";
import { FogExp2, PCFShadowMap } from "three";
import Models from "./Models";
import { DECK_Y } from "@/constants/container";
import SunLight from "./SunLight";

type CanvasProps = {
  children?: React.ReactNode;
};

export default function Scene({ children }: CanvasProps) {
  return (
    <R3FCanvas
      shadows={{ type: PCFShadowMap, enabled: true }}
      gl={{ antialias: true }}
      scene={{ fog: new FogExp2(0x00000000, 0.0001) }}
      camera={{ position: [60, 50, 80], fov: 55, near: 1, far: 20000 }}
    >
      <Suspense fallback={null}>
        <Environment
          preset="park"
          files={skybox}
          background
          backgroundIntensity={0.8}
          environmentIntensity={0.3}
        />
        <OrbitControls
          maxPolarAngle={Math.PI * 0.485}
          target={[0, DECK_Y, 0]}
          enableDamping={false}
        />
        <ambientLight intensity={0.75} />
        <SunLight />
        <Water />
        <Models />
        {children}
      </Suspense>
      <StatsGl className="absolute top-2 right-2" />
    </R3FCanvas>
  );
}
