import type { BlockDefinition } from "@/constants/block";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
  getBlockLabelSize,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import type { Group, Material, Mesh } from "three";
import { Vector3 } from "three";
import { useYardStore } from "@/stores/yard";
import {
  BLOCK_LABEL_MAX_SCALE,
  BLOCK_LABEL_MIN_SCALE,
  BLOCK_LABEL_REF_DISTANCE,
} from "./constants";

const _labelWorld = new Vector3();

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

function labelScaleForDistance(distance: number) {
  return Math.min(
    BLOCK_LABEL_MAX_SCALE,
    Math.max(BLOCK_LABEL_MIN_SCALE, distance / BLOCK_LABEL_REF_DISTANCE),
  );
}

/** 바닥과 평행한 Block 코드 라벨 — 블록 크기 + 카메라 거리에 비례 */
export default function BlockFloorLabel({
  block,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
}) {
  const deckY = useYardStore((s) => s.deckY);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const fontSize = getBlockLabelSize(block);
  const alongBay = depth >= width;
  const groupRef = useRef<Group>(null);
  const textRef = useRef<Mesh>(null);

  const handleSync = useCallback((text: Mesh) => {
    text.renderOrder = 10000;
    applyAlwaysOnTop(text.material);
  }, []);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    const text = textRef.current;
    if (!group) return;

    group.getWorldPosition(_labelWorld);
    const scale = labelScaleForDistance(camera.position.distanceTo(_labelWorld));
    group.scale.setScalar(scale);

    if (!text) return;
    text.renderOrder = 10000;
    applyAlwaysOnTop(text.material);
  });

  return (
    <group
      ref={groupRef}
      position={[center[0], deckY + block.origin[1] + 0.006, center[2]]}
      rotation={[
        -Math.PI / 2,
        0,
        (block.yaw ?? 0) + (alongBay ? 0 : Math.PI / 2),
      ]}
    >
      <Text
        ref={textRef}
        fontSize={fontSize}
        letterSpacing={0.04}
        color="#f8fafc"
        fillOpacity={0.9}
        outlineWidth={fontSize * 0.08}
        outlineColor="#0f172a"
        outlineOpacity={0.55}
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
