// import { BLOCK_BY_CODE } from "@/constants/block";
// import { occupancyTransitionProgressRef } from "@/constants/occupancyTransition";
// import { getBlockFootprintCenter } from "@/domain/blockFootprint";
// import { useYardStore } from "@/stores/yard";
// import { Helper } from "@react-three/drei";
// import { useFrame } from "@react-three/fiber";
// import { useMemo, useRef } from "react";
// import { DirectionalLight, DirectionalLightHelper } from "three";

// const SUN_POSITION: [number, number, number] = [20.09004, 20.637, 5.7129];
// const SUN_TARGET_BLOCK = "B06";

// /** 일반 모드 directional intensity — 여기서 조절 */
// const SUN_INTENSITY = 1.2;
// /** occupancy 전환 완료 시 intensity */
// const SUN_INTENSITY_OCCUPANCY = 0;

// function lerp(a: number, b: number, t: number) {
//   return a + (b - a) * t;
// }

// function useBlockWorldCenter(code: string): [number, number, number] {
//   const blocks = useYardStore((s) => s.blocks);
//   const deckY = useYardStore((s) => s.deckY);
//   const yardOffset = useYardStore((s) => s.yardOffset);

//   return useMemo(() => {
//     const block =
//       blocks.find((item) => item.code === code) ?? BLOCK_BY_CODE[code];
//     if (!block) return [0, deckY, 0];

//     const [x, , z] = getBlockFootprintCenter(block);
//     return [x + yardOffset[0], deckY + block.origin[1], z + yardOffset[2]];
//   }, [blocks, code, deckY, yardOffset]);
// }

// export default function SunLight() {
//   const target = useBlockWorldCenter(SUN_TARGET_BLOCK);
//   const lightRef = useRef<DirectionalLight>(null);

//   useFrame(() => {
//     const light = lightRef.current;
//     if (!light) return;
//     const t = occupancyTransitionProgressRef.current.t;
//     light.intensity = lerp(SUN_INTENSITY, SUN_INTENSITY_OCCUPANCY, t);
//   });

//   return (
//     <directionalLight
//       ref={lightRef}
//       position={SUN_POSITION}
//       intensity={SUN_INTENSITY}
//       color={0xffffff}
//       // castShadow
//     >
//       <object3D attach="target" position={target} />
//       <Helper type={DirectionalLightHelper} args={[5, "orange"]} />
//     </directionalLight>
//   );
// }

import { BLOCK_BY_CODE } from "@/constants/block";
import { getBlockFootprintCenter } from "@/domain/blockFootprint";
import { useYardStore } from "@/stores/yard";
import { Helper } from "@react-three/drei";
import { useMemo } from "react";
import { DirectionalLightHelper } from "three";

// const SUN_POSITION: [number, number, number] = [0.89004, 9.637, 0.7129];
// const SUN_POSITION: [number, number, number] = [0.89004, 10.993, 10.869];
const SUN_POSITION: [number, number, number] = [60.59004, 30.993, -50.869];
const SUN_TARGET_BLOCK = "B34";

function useBlockWorldCenter(code: string): [number, number, number] {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const yardOffset = useYardStore((s) => s.yardOffset);

  return useMemo(() => {
    const block =
      blocks.find((item) => item.code === code) ?? BLOCK_BY_CODE[code];
    if (!block) return [0, deckY, 0];

    const [x, , z] = getBlockFootprintCenter(block);
    return [x + yardOffset[0], deckY + block.origin[1], z + yardOffset[2]];
  }, [blocks, code, deckY, yardOffset]);
}

export default function SunLight() {
  const target = useBlockWorldCenter(SUN_TARGET_BLOCK);

  return (
    <directionalLight
      position={SUN_POSITION}
      intensity={0.02}
      color={0xffffff}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.00015}
      shadow-normalBias={0.04}
      shadow-radius={1}
      shadow-camera-near={0.2}
      shadow-camera-far={80}
      // 야드 크기에 맞춘 ortho frustum — 너무 넓으면 그림자가 흐려짐
      shadow-camera-left={-18}
      shadow-camera-right={18}
      shadow-camera-top={28}
      shadow-camera-bottom={-28}
    >
      {/* attach 없으면 light.target이 (0,0,0) 기본값 그대로 */}
      <object3D attach="target" position={target} />
      {/* <Helper type={DirectionalLightHelper} args={[5, "orange"]} /> */}
    </directionalLight>
  );
}
