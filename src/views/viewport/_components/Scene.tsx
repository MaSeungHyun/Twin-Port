import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Environment, OrbitControls, StatsGl } from "@react-three/drei";
import { Suspense, useEffect, useRef, type RefObject } from "react";
import skybox from "@/assets/image/sky.hdr";
import Water from "./Water";
import { FogExp2, PCFShadowMap } from "three";
import Models from "./Models";
import SunLight from "./SunLight";

import {
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_QUATERNION,
} from "@/constants/camera";

type CanvasProps = {
  children?: React.ReactNode;
  statsParent: RefObject<HTMLElement | null>;
};

function ResilientStatsGl({
  parent,
}: {
  parent: RefObject<HTMLElement | null>;
}) {
  const statsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sync = () => {
      const el = statsRef.current;
      if (!el) return;
      el.style.setProperty("position", "absolute", "important");
      el.style.setProperty("top", "0.5rem", "important");
      el.style.setProperty("right", "0.5rem", "important");
      el.style.setProperty("left", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
      el.style.setProperty("z-index", "20", "important");
    };

    sync();
    const raf = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    const node = parent.current;
    const observer = node ? new ResizeObserver(sync) : null;
    if (node) observer?.observe(node);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, [parent]);

  return (
    <StatsGl
      ref={statsRef as RefObject<HTMLDivElement>}
      parent={parent as RefObject<HTMLElement>}
      clearStatsGlStyle
    />
  );
}

export default function Scene({ children, statsParent }: CanvasProps) {
  return (
    <R3FCanvas
      className="absolute inset-0 h-full w-full touch-none"
      style={{ display: "block", overflow: "hidden" }}
      shadows={{ type: PCFShadowMap, enabled: true }}
      gl={{ antialias: true }}
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
          backgroundIntensity={0.7}
          environmentIntensity={0.45}
        />
        <OrbitControls
          maxPolarAngle={Math.PI * 0.475}
          enableDamping={false}
          maxDistance={220}
        />

        <ambientLight intensity={1.2} />
        <SunLight />
        <Water />
        <Models />
        {children}
      </Suspense>
      <ResilientStatsGl parent={statsParent} />
    </R3FCanvas>
  );
}
