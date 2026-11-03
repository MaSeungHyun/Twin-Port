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
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { icons } from "lucide-react";
import { useRef } from "react";
import { Group, Vector3 } from "three";

/** 원(size-3.5 = 14px) 반지름 — 원 중심이 정확히 앵커(장비 표면)에 오도록 */
const DOT_RADIUS_PX = 7;
const anchorScratch = new Vector3();

const TONE: Record<
  FailureState,
  { color: string; label: string; icon: keyof typeof icons }
> = {
  warning: { color: "#FFB020", label: "점검 대기", icon: "TriangleAlert" },
  failure: { color: "#EF2444", label: "위험", icon: "TriangleAlert" },
  safe: { color: "#2ECC71", label: "정상 복구", icon: "CircleCheck" },
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

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    anchorOf(failure, node.position);
  });

  return (
    <group ref={group}>
      {/* center 미사용: 원 중심을 앵커에 맞추기 위해 하단 원 기준으로 직접 이동 */}
      <Html zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="flex origin-bottom flex-col items-center transition-all duration-200 hover:scale-105 hover:brightness-120"
          style={{ translate: `-50% calc(-100% + ${DOT_RADIUS_PX}px)` }}
        >
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
