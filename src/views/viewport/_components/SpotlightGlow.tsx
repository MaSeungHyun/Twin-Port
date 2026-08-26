// import { Helper } from "@react-three/drei";
// import { SpotLightHelper } from "three";

import { Helper } from "@react-three/drei";
import { SpotLightHelper } from "three";

const SPOT_POSITION: [number, number, number] = [5, 10, 18];
const SPOT_TARGET: [number, number, number] = [5, 0, 18];
const SPOT_INTENSITY = 150;
/** 바닥 하얀 그라데이션 반경 */

/** spotLight + 바닥 radial gradient */
export default function SpotlightGlow() {
  return (
    <>
      <spotLight
        position={SPOT_POSITION}
        intensity={SPOT_INTENSITY}
        color={0xcccccc}
        angle={Math.PI / 2}
        penumbra={0.8}
        decay={1}
        distance={15}
      >
        <object3D attach="target" position={SPOT_TARGET} />
        {import.meta.env.DEV && <Helper type={SpotLightHelper} args={[5]} />}
      </spotLight>
    </>
  );
}
