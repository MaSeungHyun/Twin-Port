import PieChart from "@/components/PieChart";
import type { BlockDefinition } from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import {
  BLOCK_FOOTPRINT_DEPTH,
  BLOCK_FOOTPRINT_WIDTH,
  getBlockFootprintCenter,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { HIT_HEIGHT, occupancyColor } from "./constants";

export default function BlockHoverArea({
  block,
  occupancy,
  statusVisible,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
  statusVisible: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  // 한 번 마운트한 뒤엔 unmount하지 않고 visible만 토글 (재생성 비용 제거)
  const [infoMounted, setInfoMounted] = useState(false);
  const center = getBlockFootprintCenter(block.origin);
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

  return (
    <group
      position={[center[0], DECK_Y + HIT_HEIGHT / 2, center[2]]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <mesh>
        <boxGeometry
          args={[
            BLOCK_FOOTPRINT_WIDTH + 0.1,
            HIT_HEIGHT + 0.1,
            BLOCK_FOOTPRINT_DEPTH + 0.1,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.5 : 0}
          depthWrite={false}
        />
      </mesh>

      {infoMounted ? (
        <Html
          position={[0, 32, 0]}
          center
          zIndexRange={[20, 1]}
          style={{
            userSelect: "none",
            pointerEvents: "none",
            // drei Html은 Object3D.visible을 DOM에 반영하지 않음
            display: showInfo ? "block" : "none",
          }}
        >
          <div className="flex min-w-32 flex-col items-center gap-1 rounded-md bg-black/75 text-white py-0.5 border">
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
