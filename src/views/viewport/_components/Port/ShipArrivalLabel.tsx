import { cn } from "@/utils/style";
import type { ShipMark, ShipPhase } from "@/stores/useShipArrivalStore";
import { useShipArrivalStore } from "@/stores/useShipArrivalStore";
import { useViewportStore } from "@/stores/viewport";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState, type RefObject } from "react";
import { Group, Vector3 } from "three";
import type { ShipInstance } from "./Ship";

/** 앵커(16px 원) 반지름 — 점 중심이 선체 표면에 오도록 */
const ANCHOR_RADIUS_PX = 8;

function scaleY(pose: ShipInstance) {
  const s = pose.scale ?? 1;
  return typeof s === "number" ? s : s[1];
}

const PHASE_LABEL: Record<ShipPhase, string> = {
  loading: "적재",
  departing: "출항",
  arriving: "입항",
};


function ShipMarkLabel({
  mark,
  posesRef,
  anchorY,
}: {
  mark: ShipMark;
  posesRef: RefObject<ShipInstance[]>;
  anchorY: number;
}) {
  const group = useRef<Group>(null);
  const percent = Math.round(Math.min(1, Math.max(0, mark.progress)) * 100);
  const [onScreen, setOnScreen] = useState(true);
  const onRef = useRef(true);
  const last = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));
  const camStamp = useRef(0);

  useFrame(({ camera }) => {
    const pose = posesRef.current?.[mark.index];
    const node = group.current;
    if (!pose || !node) return;
    const y = pose.position[1] + anchorY * scaleY(pose);
    const stamp = camera.matrixWorld.elements[12]! + camera.matrixWorld.elements[13]! + camera.matrixWorld.elements[14]!;
    if (
      last.current.x === pose.position[0]
      && last.current.y === y
      && last.current.z === pose.position[2]
      && stamp === camStamp.current
    ) return;
    last.current.set(pose.position[0], y, pose.position[2]);
    camStamp.current = stamp;
    node.position.copy(last.current);
    const projected = last.current.clone().project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
    if (visible !== onRef.current) {
      onRef.current = visible;
      setOnScreen(visible);
    }
  });

  return (
    <group ref={group}>
      {/* center 미사용: 하단 원 중심을 앵커에 맞춤 */}
      {onScreen ? <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="flex flex-col items-center"
          style={{ translate: `-50% calc(-100% + ${ANCHOR_RADIUS_PX}px)` }}
        >
          <div
            className={cn(
              "rounded-lg bg-dt-bg/80 px-3 whitespace-nowrap shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-dt-info)_80%,transparent)]",
              mark.phase === "loading" ? "h-11" : "h-7",
            )}
          >
            <div className="flex h-7 items-center gap-1">
              <span className="text-[12px] font-bold text-dt-text">{mark.name}</span>
              <span className="text-[12px] text-dt-text-3">·</span>
              <span className="text-[12px] font-medium text-dt-info-bright">{PHASE_LABEL[mark.phase]}</span>
            </div>
            {mark.phase === "loading" ? (
              <div className="flex items-center gap-2">
                <span className="h-1 w-[104px] overflow-hidden rounded-sm bg-white/14">
                  <span className="block h-full bg-dt-info" style={{ width: `${percent}%` }} />
                </span>
                <span className="text-[10px] font-medium text-dt-info-bright tabular-nums">{percent}%</span>
              </div>
            ) : null}
          </div>
          <div className="h-5 w-px bg-dt-info/60" />
          <span className="relative grid size-4 place-items-center">
            <span className="absolute inset-0 rounded-full bg-dt-info/24" />
            <span className="size-2 rounded-full bg-dt-info" />
          </span>
        </div>
      </Html> : null}
    </group>
  );
}

/** 입·출항·적재 이벤트 신호. 상세(Berth/Cargo)는 호버 툴팁 — 라벨 떠 있는 동안은 툴팁 생략 */
export default function ShipArrivalLabel({
  posesRef,
  anchorY = 0,
}: {
  posesRef?: RefObject<ShipInstance[]>;
  anchorY?: number;
}) {
  const marks = useShipArrivalStore((state) => state.marks);
  const hudHidden = useViewportStore((s) => s.hudHidden);
  const started = useViewportStore((s) => s.monitoringStarted);
  const introOpen = useViewportStore((s) => s.introOpen);
  if (hudHidden || !started || introOpen || !posesRef || marks.length === 0) return null;
  return (
    <>
      {marks.map((mark) => (
        <ShipMarkLabel key={mark.index} mark={mark} posesRef={posesRef} anchorY={anchorY} />
      ))}
    </>
  );
}
