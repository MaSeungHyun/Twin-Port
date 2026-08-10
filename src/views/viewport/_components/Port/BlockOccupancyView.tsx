import { BLOCKS, SLOT_MAX_SIZE } from "@/constants/block";
import {
  CONTAINER_D,
  CONTAINER_H,
  CONTAINER_W,
  DECK_Y,
} from "@/constants/container";
import {
  computeBlockOccupancies,
  type BlockOccupancy,
} from "@/domain/occupancy";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, EdgesGeometry, type Mesh } from "three";
import gsap from "gsap";

const COLOR_MAP = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef2444",
};
const HEIGHT_SCALE = 5;

/** 카메라가 상공으로 올라가는 동안 시작 */
const FILL_DELAY = 0.15;
const FILL_DURATION = 1;
/** Block 순서대로 조금씩 늦게 차오르게 */
const FILL_STAGGER = 0.0;

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
  const block = useMemo(
    () => BLOCKS.find((b) => b.code === occupancy.blockCode),
    [occupancy.blockCode],
  );

  const dims = useMemo(() => {
    const width = SLOT_MAX_SIZE.rows * CONTAINER_W;
    const depth = SLOT_MAX_SIZE.bays * CONTAINER_D;
    const fullHeight = SLOT_MAX_SIZE.tiers * CONTAINER_H * HEIGHT_SCALE;
    const fillHeight = Math.max(fullHeight * occupancy.ratio, 0.02);
    return { width, depth, fullHeight, fillHeight };
  }, [occupancy.ratio]);

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
      mesh.position.y = DECK_Y + (fillHeight * progress.t) / 2;
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
  }, [dims, index, visible]);

  if (!block) return null;

  const centerX = block.origin[0] + dims.width / 2;
  const centerZ = block.origin[2] + dims.depth / 2;
  const color = occupancyColor(occupancy.ratio);

  return (
    <group visible={visible}>
      {/* 용량 전체 — 흐린 박스 */}
      <mesh
        position={[centerX, DECK_Y + dims.fullHeight / 2, centerZ]}
        geometry={shellGeometry}
      >
        <meshStandardMaterial
          color="#cbd5e1"
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        position={[centerX, DECK_Y + dims.fullHeight / 2, centerZ]}
        geometry={shellEdges}
        raycast={() => null}
      >
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
      </lineSegments>

      {/* 점유율만큼 Y 채움 */}
      <mesh
        ref={fillRef}
        position={[centerX, DECK_Y, centerZ]}
        scale={[1, 0.0001, 1]}
        raycast={() => null}
      >
        <boxGeometry args={[dims.width, dims.fillHeight, dims.depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[centerX, DECK_Y + dims.fullHeight + 1.2, centerZ]}
        center
        // 기본값 [16777271, 0]이면 헤더 Dropdown 위로 올라옴. UI(99999)보다 낮게 유지
        zIndexRange={[20, 1]}
        style={{
          userSelect: "none",
          pointerEvents: visible ? "auto" : "none",
          display: visible ? "block" : "none",
        }}
      >
        <div className="rounded-md bg-black/55 px-2 py-1 text-center whitespace-nowrap text-white shadow transition-transform duration-50 hover:z-10 hover:scale-125">
          <div className="flex items-center justify-center gap-2">
            <span className="text-base font-semibold tracking-wide text-white">
              {occupancy.blockCode}
            </span>

            <span
              className="text-base font-bold brightness-150"
              style={{ color }}
            >
              {occupancy.percent}%
            </span>
          </div>
          <div>
            <span className="ml-1 text-md text-white/70">
              ({occupancy.occupied}/{occupancy.capacity})
            </span>
          </div>
        </div>
      </Html>
    </group>
  );
}

export default function BlockOccupancyView({
  visible = true,
}: {
  visible?: boolean;
}) {
  const occupancies = useMemo(
    () => computeBlockOccupancies(mockContainers as Container[]),
    [],
  );

  return (
    <group position={[5, 0, 0]} visible={visible}>
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
