import { getBlockSlotGrid } from "@/constants/block";
import { useYardStore } from "@/stores/yard";
import { CONTAINER_H } from "@/constants/container";
import { getBlockFootprintCenter } from "@/domain/blockFootprint";
import {
  computeBlockOccupancies,
  type BlockOccupancy,
} from "@/domain/occupancy";
import { type ThreeEvent } from "@react-three/fiber";
import { useOccupancyStore } from "@/stores/occupancy";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoxGeometry, EdgesGeometry, type Mesh } from "three";
import gsap from "gsap";

const COLOR_MAP = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef2444",
};
const HEIGHT_SCALE = 5;

const FILL_DELAY = 0.15;
const FILL_DURATION = 1;
const FILL_STAGGER = 0.0;

const SHELL_OPACITY = 0.08;
const SHELL_HOVER_OPACITY = 0.32;
const LINE_OPACITY = 0.4;
const LINE_HOVER_OPACITY = 0.9;
const FILL_OPACITY = 0.8;
const FILL_HOVER_OPACITY = 1;

function occupancyColor(ratio: number): string {
  if (ratio < 0.6) return COLOR_MAP.low;
  if (ratio < 0.8) return COLOR_MAP.medium;
  return COLOR_MAP.high;
}

function BlockOccupancyBar({
  occupancy,
  index,
  visible,
}: {
  occupancy: BlockOccupancy;
  index: number;
  visible: boolean;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const setHoveredBlockCode = useOccupancyStore((s) => s.setHoveredBlockCode);
  const [hovered, setHovered] = useState(false);
  const block = useMemo(
    () => blocks.find((b) => b.code === occupancy.blockCode),
    [occupancy.blockCode, blocks],
  );

  const dims = useMemo(() => {
    if (!block) {
      return { width: 1, depth: 1, fullHeight: 1, fillHeight: 1 };
    }
    const grid = getBlockSlotGrid(block);
    const width = grid.sizeX;
    const depth = grid.sizeZ;
    const fullHeight = grid.tiers * CONTAINER_H * HEIGHT_SCALE;
    const fillHeight = Math.max(fullHeight * occupancy.ratio, 0.02);
    return { width, depth, fullHeight, fillHeight };
  }, [occupancy.ratio, block]);

  const shellGeometry = useMemo(
    () => new BoxGeometry(dims.width, dims.fullHeight, dims.depth),
    [dims.width, dims.fullHeight, dims.depth],
  );
  const shellEdges = useMemo(
    () => new EdgesGeometry(shellGeometry),
    [shellGeometry],
  );

  const fillRef = useRef<Mesh>(null);

  useEffect(() => {
    const mesh = fillRef.current;
    if (!mesh || !visible) return;

    const { fillHeight } = dims;
    const progress = { t: 0 };

    const applyProgress = () => {
      mesh.scale.y = Math.max(progress.t, 0.0001);
      mesh.position.y = (fillHeight * progress.t) / 2;
    };

    applyProgress();

    const tween = gsap.to(progress, {
      t: 1,
      duration: FILL_DURATION,
      delay: FILL_DELAY + index * FILL_STAGGER,
      ease: "power2.out",
      onUpdate: applyProgress,
    });

    return () => {
      tween.kill();
    };
  }, [dims, index, visible, deckY, block]);

  useEffect(() => {
    return () => {
      setHoveredBlockCode(null);
      document.body.style.cursor = "auto";
    };
  }, [setHoveredBlockCode]);

  if (!block) return null;

  const center = getBlockFootprintCenter(block);
  const color = occupancyColor(occupancy.ratio);
  const baseY = deckY + block.origin[1];

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    setHoveredBlockCode(occupancy.blockCode);
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    setHovered(false);
    if (
      useOccupancyStore.getState().hoveredBlockCode === occupancy.blockCode
    ) {
      setHoveredBlockCode(null);
    }
    document.body.style.cursor = "auto";
  };

  return (
    <group
      visible={visible}
      position={[center[0], baseY, center[2]]}
      rotation={[0, block.yaw ?? 0, 0]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <mesh position={[0, dims.fullHeight / 2, 0]} geometry={shellGeometry}>
        <meshStandardMaterial
          color="#3b82f6"
          transparent
          opacity={hovered ? SHELL_HOVER_OPACITY : SHELL_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        position={[0, dims.fullHeight / 2, 0]}
        geometry={shellEdges}
        raycast={() => null}
      >
        <lineBasicMaterial
          color="#60a5fa"
          transparent
          opacity={hovered ? LINE_HOVER_OPACITY : LINE_OPACITY}
        />
      </lineSegments>

      <mesh
        ref={fillRef}
        position={[0, 0, 0]}
        scale={[1, 0.0001, 1]}
        raycast={() => null}
      >
        <boxGeometry args={[dims.width, dims.fillHeight, dims.depth]} />
        <meshBasicMaterial
          color={color}
          transparent={!hovered}
          opacity={hovered ? FILL_HOVER_OPACITY : FILL_OPACITY}
          depthWrite={hovered}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function BlockOccupancyView({
  visible = true,
}: {
  visible?: boolean;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const yardOffset = useYardStore((s) => s.yardOffset);
  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );

  return (
    <group position={[...yardOffset]} visible={visible}>
      {occupancies.map((occupancy, index) => (
        <BlockOccupancyBar
          key={occupancy.blockCode}
          occupancy={occupancy}
          index={index}
          visible={visible}
        />
      ))}
    </group>
  );
}
