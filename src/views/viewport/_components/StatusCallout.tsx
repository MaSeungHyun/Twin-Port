import Icon from "@/components/Icon";
import { equipmentName, focusEquipment } from "@/domain/failureScenario";
import {
  getCraneFocusTarget,
  getOverheadCraneCalloutAnchor,
} from "@/domain/cameraFocus";
import {
  useFailureStore,
  type ActiveFailure,
  type FailureState,
} from "@/stores/useFailureStore";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { icons } from "lucide-react";
import { useRef } from "react";
import { Group } from "three";

const TONE: Record<
  FailureState,
  { color: string; label: string; icon: keyof typeof icons }
> = {
  warning: { color: "#FFB020", label: "점검 대기", icon: "TriangleAlert" },
  failure: { color: "#EF2444", label: "위험", icon: "TriangleAlert" },
  safe: { color: "#2ECC71", label: "정상 복구", icon: "CircleCheck" },
};

function anchorOf(failure: ActiveFailure) {
  return failure.kind === "quayCrane"
    ? getCraneFocusTarget(failure.index)
    : getOverheadCraneCalloutAnchor(failure.index);
}

function Callout({ failure }: { failure: ActiveFailure }) {
  const group = useRef<Group>(null);
  const tone = TONE[failure.state];
  const title = equipmentName(failure.kind, failure.index);

  useFrame(() => {
    const point = anchorOf(failure);
    const node = group.current;
    if (!point || !node) return;
    node.position.copy(point);
  });

  return (
    <group ref={group}>
      <Html center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex -translate-y-full flex-col items-center hover:scale-105 transition-all duration-200 hover:brightness-120">
          <button
            type="button"
            className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border-2 bg-black/80 px-3 py-1.5 whitespace-nowrap"
            style={{
              borderColor: tone.color,
              boxShadow: `0 0 16px ${tone.color}88, inset 0 0 12px ${tone.color}22`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              focusEquipment(failure.kind, failure.index);
            }}
          >
            <Icon
              icon={tone.icon}
              className="size-5 shrink-0"
              style={{ stroke: tone.color }}
            />
            <span className="text-[15px] font-semibold tracking-wide text-white">
              {title}
              <span className="mx-1.5 text-white/45">·</span>
              {tone.label}
            </span>
          </button>
          <div
            className="h-12 w-px"
            style={{
              background: `linear-gradient(to bottom, ${tone.color}, ${tone.color}55)`,
            }}
          />
          <div
            className="size-3.5 rounded-full"
            style={{
              background: tone.color,
              boxShadow: `0 0 0 6px ${tone.color}33, 0 0 18px ${tone.color}`,
            }}
          />
        </div>
      </Html>
    </group>
  );
}

/** 경고·위험·안전 상태가 난 장비 위에 원 + 라인 + 라벨 */
export default function StatusCallout() {
  const active = useFailureStore((s) => s.active);
  const markers = Object.values(active).filter((item) => anchorOf(item));

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
