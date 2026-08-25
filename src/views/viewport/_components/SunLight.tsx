import { BLOCK_BY_CODE } from "@/constants/block";
import { occupancyTransitionProgressRef } from "@/constants/occupancyTransition";
import { getBlockFootprintCenter } from "@/domain/blockFootprint";
import { useYardStore } from "@/stores/yard";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DirectionalLight } from "three";

const SUN_POSITION: [number, number, number] = [20.09004, 20.637, 5.7129];
const SUN_TARGET_BLOCK = "B06";

/** 일반 모드 directional intensity — 여기서 조절 */
const SUN_INTENSITY = 7;
/** occupancy 전환 완료 시 intensity */
const SUN_INTENSITY_OCCUPANCY = 0;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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
  const lightRef = useRef<DirectionalLight>(null);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const t = occupancyTransitionProgressRef.current.t;
    light.intensity = lerp(SUN_INTENSITY, SUN_INTENSITY_OCCUPANCY, t);
  });

  return (
    <directionalLight
      ref={lightRef}
      position={SUN_POSITION}
      intensity={SUN_INTENSITY}
      color={0x666669}
      // castShadow
    >
      <object3D attach="target" position={target} />
      {/* <Helper type={DirectionalLightHelper} args={[5, "orange"]} /> */}
    </directionalLight>
  );
}
