import type { ShipMark, ShipPhase } from "@/stores/useShipArrivalStore";
import { useShipArrivalStore } from "@/stores/useShipArrivalStore";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Group } from "three";
import type { ShipInstance } from "./Ship";

/** 원(size-3.5 = 14px) 반지름 — 원 중심이 정확히 선체 표면에 오도록 (StatusCallout 과 동일) */
const DOT_RADIUS_PX = 7;

function scaleY(pose: ShipInstance) {
  const s = pose.scale ?? 1;
  return typeof s === "number" ? s : s[1];
}

const PHASE_LABEL: Record<ShipPhase, string> = {
  loading: "적재",
  departing: "출항",
  arriving: "입항",
};

const PHASE_COLOR: Record<ShipPhase, string> = {
  loading: "#2ECC71",
  departing: "#4DA8FF",
  arriving: "#4DA8FF",
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
  const color = PHASE_COLOR[mark.phase];
  const percent = Math.round(Math.min(1, Math.max(0, mark.progress)) * 100);

  useFrame(() => {
    const pose = posesRef.current?.[mark.index];
    const node = group.current;
    if (!pose || !node) return;
    // 선체 중심 상단 표면(로컬 anchorY × scale) — 트윈으로 움직여도 매 프레임 따라감
    node.position.set(pose.position[0], pose.position[1] + anchorY * scaleY(pose), pose.position[2]);
  });

  return (
    <group ref={group}>
      {/* center 미사용: 하단 원 중심을 앵커에 맞춤 */}
      <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="flex flex-col items-center"
          style={{ translate: `-50% calc(-100% + ${DOT_RADIUS_PX}px)` }}
        >
          <div
            className="flex flex-col items-center rounded-2xl border-2 bg-black/80 px-3 py-1.5 whitespace-nowrap"
            style={{
              borderColor: color,
              boxShadow: `0 0 16px ${color}88`,
            }}
          >
            <span className="text-[15px] font-semibold tracking-wide text-white">
              {mark.name}
              <span className="mx-1.5 text-white/45">·</span>
              {PHASE_LABEL[mark.phase]}
            </span>
            {mark.phase === "loading" ? (
              <span className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${percent}%`, background: color }}
                  />
                </span>
                <span className="text-[11px] tabular-nums text-white/80">{percent}%</span>
              </span>
            ) : null}
          </div>
          <div
            className="h-12 w-px"
            style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }}
          />
          <div
            className="size-3.5 rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 0 6px ${color}33, 0 0 18px ${color}`,
            }}
          />
        </div>
      </Html>
    </group>
  );
}

/** 적재·출항·입항 중인 선박 위의 라벨. 적재는 단이 쌓일수록 진행 막대가 찬다. */
export default function ShipArrivalLabel({
  posesRef,
  anchorY = 0,
}: {
  posesRef?: RefObject<ShipInstance[]>;
  anchorY?: number;
}) {
  const marks = useShipArrivalStore((state) => state.marks);
  if (!posesRef || marks.length === 0) return null;
  return (
    <>
      {marks.map((mark) => (
        <ShipMarkLabel key={mark.index} mark={mark} posesRef={posesRef} anchorY={anchorY} />
      ))}
    </>
  );
}
