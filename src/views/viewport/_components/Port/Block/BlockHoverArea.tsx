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
import { useCallback, useLayoutEffect, useRef } from "react";
import { type MeshBasicMaterial } from "three";
import { occupancyColor } from "./constants";

/** BlockOccupancyView HEIGHT_SCALE와 맞춤 — occupancy 그래프 위로 카드 띄움 */
const OCCUPANCY_BAR_HEIGHT_SCALE = 5;
const HIT_HEIGHT_MIN = 0.08;
const CARD_LIFT = 0.07;
const OCCUPANCY_CARD_EXTRA = 0.4;

export default function BlockHoverArea({
  block,
  occupancy,
  statusVisible,
  hitEnabled = true,
  tracked = false,
}: {
  block: BlockDefinition;
  occupancy: BlockOccupancy;
  statusVisible: boolean;
  hitEnabled?: boolean;
  tracked?: boolean;
}) {
  const deckY = useYardStore((s) => s.deckY);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const color = occupancyColor(occupancy.ratio);

  const applyVisual = useCallback(() => {
    const fromStore =
      useOccupancyStore.getState().hoveredBlockCode === block.code;
    const show = statusVisible || tracked || hoveredRef.current || fromStore;
    const material = materialRef.current;
    if (material) {
      material.opacity = hitEnabled && hoveredRef.current ? 0.5 : 0;
    }
    if (cardRef.current) {
      cardRef.current.style.visibility = show ? "visible" : "hidden";
    }
  }, [block.code, statusVisible, tracked, hitEnabled]);

  useLayoutEffect(() => {
    applyVisual();
    return useOccupancyStore.subscribe((state, prev) => {
      if (state.hoveredBlockCode === prev.hoveredBlockCode) return;
      if (
        state.hoveredBlockCode !== block.code &&
        prev.hoveredBlockCode !== block.code
      ) {
        return;
      }
      applyVisual();
    });
  }, [applyVisual, block.code]);

  useLayoutEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hoveredRef.current = true;
    document.body.style.cursor = "pointer";
    applyVisual();
  };

  const handleOut = () => {
    hoveredRef.current = false;
    document.body.style.cursor = "auto";
    applyVisual();
  };

  const grid = getBlockSlotGrid(block);
  const hitHeight = Math.max(grid.tiers * CONTAINER_H * 3, HIT_HEIGHT_MIN);
  const occupancyLift =
    grid.tiers * CONTAINER_H * (OCCUPANCY_BAR_HEIGHT_SCALE - 3) +
    OCCUPANCY_CARD_EXTRA;

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
          ref={materialRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[
          0,
          hitHeight / 2 + CARD_LIFT + (hitEnabled ? 0 : occupancyLift),
          0,
        ]}
        center
        zIndexRange={[20, 1]}
        style={{
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        <div
          ref={cardRef}
          className="flex items-center gap-md rounded-lg border-[2px] bg-[#2a2a2a]/95 py-[23px] pl-sm pr-[15.26px] shadow-lg w-[162px] h-[60px] justify-between bg-[#00000080]"
          style={{ visibility: "hidden", borderColor: color }}
        >
          <div className="flex items-center gap-xs">
            <span
              className="size-lg shrink-0 rounded-full aspect-square"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-light tracking-wide text-text-primary">
              {block.code}
            </span>
          </div>
          <div className="relative shrink-0">
            <PieChart
              value={occupancy.percent}
              color={color}
              size={46}
              trackColor="rgba(255,255,255,0.1)"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="text-md font-bold leading-none tracking-normal"
                style={{ color }}
              >
                {occupancy.percent.toString().split(".")[0]}
                <span
                  className="text-sm font-semibold text-text-secondary"
                  style={{ color }}
                >
                  %
                </span>
              </span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
