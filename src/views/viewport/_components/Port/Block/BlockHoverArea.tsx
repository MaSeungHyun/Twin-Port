import PieChart from "@/components/PieChart";
import { getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { CONTAINER_H } from "@/constants/container";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { useOccupancyStore } from "@/stores/occupancy";
import { useYardStore } from "@/stores/yard";
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { occupancyColor } from "./constants";

/** BlockOccupancyView HEIGHT_SCALE와 맞춤 — occupancy 그래프 위로 카드 띄움 */
const OCCUPANCY_BAR_HEIGHT_SCALE = 5;

export default function BlockHoverArea({
  block,
  occupancy,
  statusVisible,
  hitEnabled = true,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
  statusVisible: boolean;
  hitEnabled?: boolean;
}) {
  const deckY = useYardStore((s) => s.deckY);
  const hoveredBlockCode = useOccupancyStore((s) => s.hoveredBlockCode);
  const [hovered, setHovered] = useState(false);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const color = occupancyColor(occupancy.ratio);
  const showInfo =
    statusVisible || hovered || hoveredBlockCode === block.code;

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

  const grid = getBlockSlotGrid(block);
  const hitHeight = Math.max(grid.tiers * CONTAINER_H * 3, 0.4);
  const occupancyLift =
    grid.tiers * CONTAINER_H * (OCCUPANCY_BAR_HEIGHT_SCALE - 3) + 10;

  return (
    <group
      position={[center[0], deckY + block.origin[1] + hitHeight / 2, center[2]]}
      onPointerOver={hitEnabled ? handleOver : undefined}
      onPointerOut={hitEnabled ? handleOut : undefined}
    >
      <mesh
        rotation={[0, block.yaw ?? 0, 0]}
        raycast={hitEnabled ? undefined : () => null}
      >
        <boxGeometry args={[width, hitHeight, depth]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hitEnabled && hovered ? 0.5 : 0}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[
          0,
          hitHeight / 2 + 0.35 + (hitEnabled ? 0 : occupancyLift),
          0,
        ]}
        center
        zIndexRange={[20, 1]}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          visibility: showInfo ? "visible" : "hidden",
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
    </group>
  );
}
