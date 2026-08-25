// import { Helper } from "@react-three/drei";
// import { SpotLightHelper } from "three";

const SPOT_POSITION: [number, number, number] = [3, 10, 25];
const SPOT_TARGET: [number, number, number] = [3, 0, 25];
const SPOT_INTENSITY = 150;
/** 바닥 하얀 그라데이션 반경 */

/** spotLight + 바닥 radial gradient */
export default function SpotlightGlow() {
  return (
    <>
      {/* <mesh
        position={[SPOT_TARGET[0], SPOT_GLOW_Y, SPOT_TARGET[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
        raycast={() => null}
      >
        <circleGeometry args={[SPOT_GLOW_RADIUS, 32]} />
        <meshBasicMaterial
          map={glowMap ?? undefined}
          color={0xffffff}
          transparent
          opacity={0.02}
          depthWrite={false}
          depthTest={true}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh> */}

      <spotLight
        position={SPOT_POSITION}
        intensity={SPOT_INTENSITY}
        color={0xffffff}
        angle={Math.PI / 2}
        penumbra={0.3}
        decay={1.6}
        distance={30}
      >
        <object3D attach="target" position={SPOT_TARGET} />
        {/* {import.meta.env.DEV && <Helper type={SpotLightHelper} args={[5]} />} */}
      </spotLight>
    </>
  );
}
