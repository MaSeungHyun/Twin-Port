import Icon from "@/components/Icon";
import { equipmentName, focusEquipment } from "@/domain/failureScenario";
import {
  getOverheadCraneCalloutAnchor,
  getQuayCraneCalloutAnchor,
} from "@/domain/cameraFocus";
import {
  useFailureStore,
  type ActiveFailure,
  type FailureState,
} from "@/stores/useFailureStore";
import { cn } from "@/utils/style";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { icons } from "lucide-react";
import { useRef, useState } from "react";
import { Group, Vector3 } from "three";

/** 앵커(16px 원) 반지름 — 점 중심이 장비 표면에 오도록 */
const ANCHOR_RADIUS_PX = 8;
const anchorScratch = new Vector3();

const TONE: Record<
  FailureState,
  { button: string; text: string; iconClass: string; line: string; halo: string; dot: string; label: string; icon: keyof typeof icons }
> = {
  warning: {
    button: "shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-dt-warn)_80%,transparent)]",
    text: "text-dt-warn-bright",
    iconClass: "stroke-dt-warn",
    line: "bg-dt-warn/60",
    halo: "bg-dt-warn/24",
    dot: "bg-dt-warn",
    label: "점검 대기",
    icon: "CircleAlert",
  },
  failure: {
    button: "shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-dt-danger)_80%,transparent)]",
    text: "text-dt-danger-bright",
    iconClass: "stroke-dt-danger",
    line: "bg-dt-danger/60",
    halo: "bg-dt-danger/24",
    dot: "bg-dt-danger",
    label: "위험",
    icon: "TriangleAlert",
  },
  safe: {
    button: "shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--color-dt-ok)_80%,transparent)]",
    text: "text-dt-ok-bright",
    iconClass: "stroke-dt-ok",
    line: "bg-dt-ok/60",
    halo: "bg-dt-ok/24",
    dot: "bg-dt-ok",
    label: "정상 복구",
    icon: "CircleCheck",
  },
};

/** 장비 실제 표면 위 world 좌표 (out 재사용, 매 프레임 갱신 → 이동하는 장비도 따라감) */
function anchorOf(failure: ActiveFailure, out: Vector3 = anchorScratch) {
  return failure.kind === "quayCrane"
    ? getQuayCraneCalloutAnchor(failure.index, out)
    : getOverheadCraneCalloutAnchor(failure.index, out);
}

function Callout({ failure }: { failure: ActiveFailure }) {
  const group = useRef<Group>(null);
  const tone = TONE[failure.state];
  const title = equipmentName(failure.kind, failure.index);
  const [onScreen, setOnScreen] = useState(true);
  const onRef = useRef(true);
  const last = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));
  const camStamp = useRef(0);

  useFrame(({ camera }) => {
    const node = group.current;
    if (!node) return;
    const next = anchorOf(failure);
    if (!next) return;
    const stamp = camera.matrixWorld.elements[12]! + camera.matrixWorld.elements[13]! + camera.matrixWorld.elements[14]!;
    if (next.distanceToSquared(last.current) < 1e-4 && stamp === camStamp.current) return;
    last.current.copy(next);
    camStamp.current = stamp;
    node.position.copy(next);
    const projected = next.clone().project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
    if (visible !== onRef.current) {
      onRef.current = visible;
      setOnScreen(visible);
    }
  });

  return (
    <group ref={group}>
      {/* center 미사용: 원 중심을 앵커에 맞추기 위해 하단 원 기준으로 직접 이동 */}
      {onScreen ? <Html zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="flex flex-col items-center"
          style={{ translate: `-50% calc(-100% + ${ANCHOR_RADIUS_PX}px)` }}
        >
          <button
            type="button"
            className={cn("pointer-events-auto flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-dt-bg/80 px-3 whitespace-nowrap", tone.button)}
            onClick={(event) => {
              event.stopPropagation();
              focusEquipment(failure.kind, failure.index);
            }}
          >
            <Icon icon={tone.icon} className={cn("size-4 shrink-0", tone.iconClass)} />
            <span className="text-[12px] font-bold text-dt-text">{title}</span>
            <span className="text-[12px] text-dt-text-3">·</span>
            <span className={cn("text-[12px] font-medium", tone.text)}>{tone.label}</span>
          </button>
          <div className={cn("h-5 w-px", tone.line)} />
          <span className="relative grid size-4 place-items-center">
            <span className={cn("absolute inset-0 rounded-full", tone.halo)} />
            <span className={cn("size-2 rounded-full", tone.dot)} />
          </span>
        </div>
      </Html> : null}
    </group>
  );
}

/** 경고·위험·안전 이벤트 신호만 (원인·수치는 패널/토스트) */
export default function StatusCallout() {
  const active = useFailureStore((s) => s.active);
  const markers = Object.values(active).filter((item) => anchorOf(item, new Vector3()));

  return (
    <>
      {markers.map((failure) => (
        <Callout
          key={`${failure.kind}:${failure.index}:${failure.state}`}
          failure={failure}
        />
      ))}
    </>
  );
}
