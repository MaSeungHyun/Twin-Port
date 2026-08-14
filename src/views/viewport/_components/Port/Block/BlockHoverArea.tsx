import PieChart from "@/components/PieChart";
import { getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { CONTAINER_H } from "@/constants/container";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { occupancyColor } from "./constants";

export default function BlockHoverArea({
  block,
  occupancy,
  statusVisible,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
  statusVisible: boolean;
}) {
  const deckY = useYardStore((s) => s.deckY);
  const [hovered, setHovered] = useState(false);
  // 한 번 마운트한 뒤엔 unmount하지 않고 visible만 토글 (재생성 비용 제거)
  const [infoMounted, setInfoMounted] = useState(false);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const color = occupancyColor(occupancy.ratio);
  const showInfo = statusVisible || hovered;
  if (showInfo && !infoMounted) {
    setInfoMounted(true);
  }

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  const hitHeight = Math.max(
    getBlockSlotGrid(block).tiers * CONTAINER_H * 3,
    0.4,
  );

  return (
    <group
      position={[center[0], deckY + block.origin[1] + hitHeight / 2, center[2]]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <mesh rotation={[0, block.yaw ?? 0, 0]}>
        <boxGeometry args={[width, hitHeight, depth]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.5 : 0}
          depthWrite={false}
        />
      </mesh>

      {infoMounted ? (
        <Html
          position={[0, hitHeight / 2 + 0.35, 0]}
          center
          zIndexRange={[20, 1]}
          style={{
            userSelect: "none",
            pointerEvents: "none",
            // drei Html은 Object3D.visible을 DOM에 반영하지 않음
            display: showInfo ? "block" : "none",
          }}
        >
          <div className="flex min-w-32 flex-col items-center gap-1 rounded-md bg-black/75 text-white py-0.5 border border-background">
            <span className="text-base font-semibold tracking-wide">
              {block.code}
            </span>
            <div className="flex items-center">
              <PieChart value={occupancy.percent} color={color} size={42} />
            </div>
            <span className="text-base font-bold" style={{ color }}>
              {occupancy.percent}%
            </span>
            <span className="text-sm text-white/80">
              {occupancy.occupied} / {occupancy.capacity}
            </span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
