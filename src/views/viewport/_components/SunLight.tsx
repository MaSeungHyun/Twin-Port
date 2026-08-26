import { Helper } from "@react-three/drei";
import {
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_SHADOW_BIAS,
  SUN_SHADOW_BLUR_SAMPLES,
  SUN_SHADOW_CAMERA,
  SUN_SHADOW_MAP_SIZE,
  SUN_SHADOW_NORMAL_BIAS,
  SUN_SHADOW_RADIUS,
} from "@/constants/sunLight";
import { DirectionalLightHelper } from "three";

// const SUN_POSITION: [number, number, number] = [-30.59004, 90.993, 40.869];
const SUN_POSITION: [number, number, number] = [-10.59004, 100.993, 80.869];
// const SUN_TARGET: [number, number, number] = [10, 0, 3];
const SUN_TARGET: [number, number, number] = [-3, 0, -15];

export default function SunLight() {
  return (
    <directionalLight
      position={SUN_POSITION}
      intensity={SUN_INTENSITY}
      color={SUN_COLOR}
      castShadow
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
      <object3D attach="target" position={SUN_TARGET} />
      {import.meta.env.DEV && (
        <Helper type={DirectionalLightHelper} args={[5, "orange"]} />
      )}
    </directionalLight>
  );
}
