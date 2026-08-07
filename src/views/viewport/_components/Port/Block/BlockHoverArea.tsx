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
  const center = getBlockFootprintCenter(block.origin);
  const color = occupancyColor(occupancy.ratio);
  const showInfo = statusVisible || hovered;

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

      {showInfo ? (
        <Html
          position={[0, HIT_HEIGHT / 2 + 1.2, 0]}
          center
          zIndexRange={[20, 1]}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          <div className="min-w-52 rounded-md bg-black/30 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold tracking-wide">
                {block.code}
              </span>
              <span className="text-base font-bold" style={{ color }}>
                {occupancy.percent}%
              </span>
            </div>
            <div className="mt-0.5 text-xs text-white/55">{block.name}</div>
            <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-xs text-white/75">
              <div className="flex justify-between gap-4">
                <span>점유</span>
                <span className="tabular-nums text-white/90">
                  {occupancy.occupied} / {occupancy.capacity}
                </span>
              </div>
            </div>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
