import { Helper } from "@react-three/drei";
import {
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
  SUN_SHADOW_BIAS,
  SUN_SHADOW_BLUR_SAMPLES,
  SUN_SHADOW_CAMERA,
  SUN_SHADOW_MAP_SIZE,
  SUN_SHADOW_NORMAL_BIAS,
  SUN_SHADOW_RADIUS,
  SUN_TARGET,
} from "@/constants/sunLight";
import { useMemo } from "react";
import { DirectionalLightHelper, Object3D } from "three";
import SunGlow from "./SunGlow";

export default function SunLight() {
  const target = useMemo(() => {
    const node = new Object3D();
    node.position.set(...SUN_TARGET);
    return node;
  }, []);

  return (
    <>
      <primitive object={target}>
        <SunGlow />
      </primitive>
      <directionalLight
        position={SUN_POSITION}
        target={target}
        intensity={SUN_INTENSITY}
        color={SUN_COLOR}
        // castShadow
        shadow-mapSize={[SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE]}
        shadow-bias={SUN_SHADOW_BIAS}
        shadow-normalBias={SUN_SHADOW_NORMAL_BIAS}
        shadow-radius={SUN_SHADOW_RADIUS}
        shadow-blurSamples={SUN_SHADOW_BLUR_SAMPLES}
        shadow-camera-near={SUN_SHADOW_CAMERA.near}
        shadow-camera-far={SUN_SHADOW_CAMERA.far}
        shadow-camera-left={SUN_SHADOW_CAMERA.left}
        shadow-camera-right={SUN_SHADOW_CAMERA.right}
        shadow-camera-top={SUN_SHADOW_CAMERA.top}
        shadow-camera-bottom={SUN_SHADOW_CAMERA.bottom}
      >
        {import.meta.env.DEV && (
          <Helper type={DirectionalLightHelper} args={[5, "orange"]} />
        )}
      </directionalLight>
    </>
  );
}
