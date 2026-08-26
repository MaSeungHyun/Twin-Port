import { getBlockSlotGrid } from "@/constants/block";
import { useYardStore } from "@/stores/yard";
import { CONTAINER_H } from "@/constants/container";
import { getBlockFootprintCenter } from "@/domain/blockFootprint";
import {
  computeBlockOccupancies,
  occupancyColor,
  type BlockOccupancy,
} from "@/domain/occupancy";
import { type ThreeEvent } from "@react-three/fiber";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  EdgesGeometry,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from "three";
import gsap from "gsap";

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

function BlockOccupancyBar({
  occupancy,
  index,
  visible,
  tracked,
}: {
  occupancy: BlockOccupancy;
  index: number;
  visible: boolean;
  tracked: boolean;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const setHoveredBlockCode = useOccupancyStore((s) => s.setHoveredBlockCode);
  const hoveredRef = useRef(false);
  const shellMatRef = useRef<MeshStandardMaterial>(null);
  const lineMatRef = useRef<LineBasicMaterial>(null);
  const fillMatRef = useRef<MeshBasicMaterial>(null);
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
  const trackedRef = useRef(tracked);

  const applyHover = () => {
    const active = hoveredRef.current || trackedRef.current;
    const shell = shellMatRef.current;
    const line = lineMatRef.current;
    const fill = fillMatRef.current;
    if (shell) shell.opacity = active ? SHELL_HOVER_OPACITY : SHELL_OPACITY;
    if (line) line.opacity = active ? LINE_HOVER_OPACITY : LINE_OPACITY;
    if (fill) fill.opacity = active ? FILL_HOVER_OPACITY : FILL_OPACITY;
  };

  useLayoutEffect(() => {
    trackedRef.current = tracked;
    applyHover();
  }, [tracked]);

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
    hoveredRef.current = true;
    setHoveredBlockCode(occupancy.blockCode);
    document.body.style.cursor = "pointer";
    applyHover();
  };

  const handleOut = () => {
    hoveredRef.current = false;
    if (useOccupancyStore.getState().hoveredBlockCode === occupancy.blockCode) {
      setHoveredBlockCode(null);
    }
    document.body.style.cursor = "auto";
    applyHover();
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
          ref={shellMatRef}
          color="#3b82f6"
          transparent
          opacity={tracked ? SHELL_HOVER_OPACITY : SHELL_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        position={[0, dims.fullHeight / 2, 0]}
        geometry={shellEdges}
        raycast={() => null}
      >
        <lineBasicMaterial
          ref={lineMatRef}
          color="#60a5fa"
          transparent
          opacity={tracked ? LINE_HOVER_OPACITY : LINE_OPACITY}
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
          ref={fillMatRef}
          color={color}
          transparent
          opacity={tracked ? FILL_HOVER_OPACITY : FILL_OPACITY}
          depthWrite={false}
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
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const trackedBlockCode = useMemo(() => {
    if (!selectedContainerId) return null;
    return (
      containers.find((item) => item.id === selectedContainerId)?.location
        .block ?? null
    );
  }, [containers, selectedContainerId]);

  return (
    <group position={[...yardOffset]} visible={visible}>
      {occupancies.map((occupancy, index) => (
        <BlockOccupancyBar
          key={occupancy.blockCode}
          occupancy={occupancy}
          index={index}
          visible={visible}
          tracked={occupancy.blockCode === trackedBlockCode}
        />
      ))}
    </group>
  );
}
