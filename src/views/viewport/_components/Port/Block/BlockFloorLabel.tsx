import type { BlockDefinition } from "@/constants/block";
import { getBlockFootprintCenter } from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import type { Material, Mesh } from "three";
import { LABEL_Y } from "./constants";

function applyAlwaysOnTop(material: Material | Material[] | undefined) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  for (const mat of list) {
    if (mat.depthTest || mat.depthWrite || !mat.transparent) {
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  }
}

/** 바닥과 평행한 Block 코드 라벨 (drei Text = Troika) */
export default function BlockFloorLabel({
  block,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
}) {
  const center = getBlockFootprintCenter(block.origin);
  const textRef = useRef<Mesh>(null);

  const handleSync = useCallback((text: Mesh) => {
    text.renderOrder = 10000;
    applyAlwaysOnTop(text.material);
  }, []);

  // Troika sync 후에도 material이 리셋될 수 있어 매 프레임 유지
  useFrame(() => {
    const text = textRef.current;
    if (!text) return;
    text.renderOrder = 10000;
    applyAlwaysOnTop(text.material);
  });

  return (
    <group
      position={[center[0], LABEL_Y, center[2]]}
      rotation={[-Math.PI / 2, 0, Math.PI / 2]}
    >
      <Text
        ref={textRef}
        fontSize={5}
        letterSpacing={0.06}
        color="#f8fafc"
        fillOpacity={0.8}
        outlineWidth={0.06}
        outlineColor="#0f172a"
        outlineOpacity={0}
        anchorX="center"
        anchorY="middle"
        renderOrder={10000}
        depthOffset={2}
        onSync={handleSync}
      >
        {block.code}
      </Text>
    </group>
  );
}
