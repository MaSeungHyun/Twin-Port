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
  LineBasicMaterial,
  type LineSegments,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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

type BarMaterials = {
  shellRest: MeshStandardMaterial;
  shellHot: MeshStandardMaterial;
  lineRest: LineBasicMaterial;
  lineHot: LineBasicMaterial;
  fillRest: Record<string, MeshBasicMaterial>;
  fillHot: Record<string, MeshBasicMaterial>;
};

function makeBarMaterials(): BarMaterials {
  const shell = (opacity: number) =>
    new MeshStandardMaterial({ color: "#3b82f6", transparent: true, opacity, depthWrite: false });
  const line = (opacity: number) =>
    new LineBasicMaterial({ color: "#60a5fa", transparent: true, opacity });
  const fill = (color: string, opacity: number) =>
    new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const colors = ["#14d99b", "#ffb020", "#f0484a"];
  const fills = (opacity: number) => Object.fromEntries(colors.map((color) => [color, fill(color, opacity)]));
  return {
    shellRest: shell(SHELL_OPACITY),
    shellHot: shell(SHELL_HOVER_OPACITY),
    lineRest: line(LINE_OPACITY),
    lineHot: line(LINE_HOVER_OPACITY),
    fillRest: fills(FILL_OPACITY),
    fillHot: fills(FILL_HOVER_OPACITY),
  };
}

function BlockOccupancyBar({
  occupancy,
  index,
  visible,
  tracked,
  materials,
}: {
  occupancy: BlockOccupancy;
  index: number;
  visible: boolean;
  tracked: boolean;
  materials: BarMaterials;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const setHoveredBlockCode = useOccupancyStore((s) => s.setHoveredBlockCode);
  const hoveredRef = useRef(false);
  const shellRef = useRef<Mesh>(null);
  const lineRef = useRef<LineSegments>(null);
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

  const colorKey = occupancyColor(occupancy.ratio).toLowerCase();

  const applyHover = () => {
    const active = hoveredRef.current || trackedRef.current;
    const shell = shellRef.current;
    if (shell) shell.material = active ? materials.shellHot : materials.shellRest;
    const line = lineRef.current;
    if (line) line.material = active ? materials.lineHot : materials.lineRest;
    const fill = fillRef.current;
    const fills = active ? materials.fillHot : materials.fillRest;
    if (fill) fill.material = fills[colorKey] ?? materials.fillRest[colorKey] ?? materials.fillRest["#14d99b"]!;
  };

  useLayoutEffect(() => {
    trackedRef.current = tracked;
    applyHover();
  }, [tracked, colorKey, materials]);

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
      userData={{ occupancyOnly: true }}
      position={[center[0], baseY, center[2]]}
      rotation={[0, block.yaw ?? 0, 0]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <mesh
        ref={shellRef}
        position={[0, dims.fullHeight / 2, 0]}
        geometry={shellGeometry}
        material={tracked ? materials.shellHot : materials.shellRest}
      />
      <lineSegments
        ref={lineRef}
        position={[0, dims.fullHeight / 2, 0]}
        geometry={shellEdges}
        material={tracked ? materials.lineHot : materials.lineRest}
        raycast={() => null}
      />

      <mesh
        ref={fillRef}
        position={[0, 0, 0]}
        scale={[1, 0.0001, 1]}
        material={(tracked ? materials.fillHot : materials.fillRest)[colorKey] ?? materials.fillRest["#14d99b"]}
        raycast={() => null}
      >
        <boxGeometry args={[dims.width, dims.fillHeight, dims.depth]} />
      </mesh>
    </group>
  );
}

export default function BlockOccupancyView({
  visible = true,
  onlyBlockCode = null,
}: {
  visible?: boolean;
  /** 블록 위치추적 — 이 블록 막대만 보인다 (null = 전체). 재질은 그대로, visible 만 바꾼다 */
  onlyBlockCode?: string | null;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const yardOffset = useYardStore((s) => s.yardOffset);
  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );
  const materials = useMemo(() => makeBarMaterials(), []);
  useEffect(() => {
    return () => {
      for (const material of [
        materials.shellRest,
        materials.shellHot,
        materials.lineRest,
        materials.lineHot,
        ...Object.values(materials.fillRest),
        ...Object.values(materials.fillHot),
      ]) material.dispose();
    };
  }, [materials]);
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const focusBlockCode = useViewportStore((s) => s.trackedBlockCode);
  const trackedBlockCode = useMemo(() => {
    if (!selectedContainerId) return null;
    return (
      containers.find((item) => item.id === selectedContainerId)?.location
        .block ?? null
    );
  }, [containers, selectedContainerId]);

  return (
    <group position={[...yardOffset]} visible={visible} userData={{ occupancyOnly: true }}>
      {occupancies.map((occupancy, index) => (
        <BlockOccupancyBar
          key={occupancy.blockCode}
          occupancy={occupancy}
          index={index}
          visible={visible && (onlyBlockCode == null || occupancy.blockCode === onlyBlockCode)}
          tracked={occupancy.blockCode === trackedBlockCode || occupancy.blockCode === focusBlockCode}
          materials={materials}
        />
      ))}
    </group>
  );
}
