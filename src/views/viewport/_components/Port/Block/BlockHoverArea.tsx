import HoverTooltip from "@/components/ui/HoverTooltip";
import { getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { CONTAINER_H } from "@/constants/container";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
} from "@/domain/blockFootprint";
import { occupancyLevel, type BlockOccupancy } from "@/domain/occupancy";
import { useOccupancyStore } from "@/stores/occupancy";
import { useYardStore } from "@/stores/yard";
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { occupancyColor } from "./constants";

/** BlockOccupancyView HEIGHT_SCALE와 맞춤 — occupancy 그래프 위로 카드 띄움 */
const OCCUPANCY_BAR_HEIGHT_SCALE = 5;
const HIT_HEIGHT_MIN = 0.08;
/** 일반 뷰 히트는 바닥면만. 높은 볼륨은 옆에서 보면 다른 블록을 가린다 */
const FLOOR_HIT_HEIGHT = 0.6;
const CARD_LIFT = 0.07;
const OCCUPANCY_CARD_EXTRA = 0.4;
const POINTER_GAP = 16;

function placeTooltip(el: HTMLElement, x: number, y: number) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = x + POINTER_GAP;
  let top = y + POINTER_GAP;
  if (left + width > window.innerWidth) left = x - POINTER_GAP - width;
  if (top + height > window.innerHeight) top = y - POINTER_GAP - height;
  el.style.transform = `translate(${Math.max(0, Math.round(left))}px, ${Math.max(0, Math.round(top))}px)`;
}

const BLOCK_STATUS = {
  safe: { label: "여유", tone: "ok" },
  warning: { label: "주의", tone: "warning" },
  danger: { label: "위험", tone: "danger" },
} as const;

type CursorTip = { block: BlockDefinition; occupancy: BlockOccupancy };
let cursorTip: CursorTip | null = null;
const cursorListeners = new Set<() => void>();
const cursorPointer = { x: 0, y: 0 };
let placeCursorTip: ((x: number, y: number) => void) | null = null;

function setCursorTip(next: CursorTip | null) {
  const changed = cursorTip?.block.code !== next?.block.code;
  cursorTip = next;
  if (changed) cursorListeners.forEach((listener) => listener());
}

function moveCursorTip(x: number, y: number) {
  cursorPointer.x = x;
  cursorPointer.y = y;
  placeCursorTip?.(x, y);
}

function BlockTooltip({ block, occupancy }: { block: BlockDefinition; occupancy: BlockOccupancy }) {
  const status = BLOCK_STATUS[occupancyLevel(occupancy.ratio)];
  return (
    <HoverTooltip
      title={block.code}
      status={status}
      rows={[
        { label: "적재율", value: `${occupancy.percent}%` },
        { label: "장치", value: `${occupancy.occupied.toLocaleString()} / ${occupancy.capacity.toLocaleString()}` },
      ]}
      progress={{ value: occupancy.percent, tone: status.tone }}
    />
  );
}

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
  const cardRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);
  const center = getBlockFootprintCenter(block);
  const { width, depth } = getBlockFootprintSize(block);
  const color = occupancyColor(occupancy.ratio);

  const applyVisual = useCallback(() => {
    const fromStore =
      useOccupancyStore.getState().hoveredBlockCode === block.code;
    if (cardRef.current) {
      cardRef.current.style.visibility =
        !hoveredRef.current && (statusVisible || fromStore) ? "visible" : "hidden";
    }
  }, [block.code, statusVisible]);

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
    setCursorTip({ block, occupancy });
    moveCursorTip(event.nativeEvent.clientX, event.nativeEvent.clientY);
    applyVisual();
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!hoveredRef.current) return;
    moveCursorTip(event.nativeEvent.clientX, event.nativeEvent.clientY);
  };

  const handleOut = () => {
    hoveredRef.current = false;
    if (cursorTip?.block.code === block.code) setCursorTip(null);
    document.body.style.cursor = "auto";
    applyVisual();
  };

  const grid = getBlockSlotGrid(block);
  const hitHeight = hitEnabled
    ? FLOOR_HIT_HEIGHT
    : Math.max(grid.tiers * CONTAINER_H * 3, HIT_HEIGHT_MIN);
  const occupancyLift =
    grid.tiers * CONTAINER_H * (OCCUPANCY_BAR_HEIGHT_SCALE - 3) +
    OCCUPANCY_CARD_EXTRA;

  return (
    <group
      position={[center[0], deckY + block.origin[1] + hitHeight / 2, center[2]]}
      onPointerOver={hitEnabled ? handleOver : undefined}
      onPointerMove={hitEnabled ? handleMove : undefined}
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
          opacity={0}
          depthWrite={false}
          // [perf] 히트 판정 전용(투명도 0) → 렌더 생략. Mesh.raycast 는 material.visible 을 보지 않으므로 호버 유지
          visible={false}
        />
      </mesh>

      {statusVisible ? (
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
          <div ref={cardRef} style={{ visibility: "hidden" }}>
            <BlockTooltip block={block} occupancy={occupancy} />
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/** 블록 호버 툴팁. 커서 오른쪽 아래 16px, 화면 끝에서는 반대쪽 */
export function BlockCursorTooltip() {
  const tip = useSyncExternalStore(
    (listener) => {
      cursorListeners.add(listener);
      return () => cursorListeners.delete(listener);
    },
    () => cursorTip,
  );
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    placeCursorTip = (x, y) => {
      const el = ref.current;
      if (el) placeTooltip(el, x, y);
    };
    const el = ref.current;
    if (el) placeTooltip(el, cursorPointer.x, cursorPointer.y);
    return () => {
      placeCursorTip = null;
    };
  });

  if (!tip) return null;
  return (
    <div ref={ref} className="pointer-events-none fixed top-0 left-0 z-[155]">
      <BlockTooltip block={tip.block} occupancy={tip.occupancy} />
    </div>
  );
}
