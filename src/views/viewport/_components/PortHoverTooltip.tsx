import HoverTooltip, { type HoverTooltipTone } from "@/components/ui/HoverTooltip";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { getPointerHover, registerPortOutlineApplier, type PortHover } from "@/domain/hoverOutline";
import { quayGlbIndexOfHover } from "@/domain/hoverTooltip";
import {
  getOverheadCraneTwinProfile,
  overheadCraneBlockCode,
  overheadCraneTitle,
} from "@/domain/overheadCraneTwin";
import { getCraneTwinProfile, getShipTwinProfile, shipStatusLabel } from "@/domain/portTwinMock";
import { isFailed, useFailureStore } from "@/stores/useFailureStore";
import { useShipArrivalStore } from "@/stores/useShipArrivalStore";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TooltipInfo = {
  title: string;
  status: { label: string; tone: HoverTooltipTone };
  rows: { label: string; value: string }[];
};

/**
 * 월드 라벨/콜아웃이 이미 같은 대상을 말하는 중이면 툴팁 생략.
 * — 선박 입출항 라벨, 크레인 StatusCallout 과 중복 방지
 */
function hasWorldSignal(
  hover: NonNullable<PortHover>,
  active: ReturnType<typeof useFailureStore.getState>["active"],
  shipMarks: ReturnType<typeof useShipArrivalStore.getState>["marks"],
): boolean {
  if (hover.kind === "ship") {
    const index = Number(hover.id);
    return Number.isInteger(index) && shipMarks.some((m) => m.index === index);
  }
  const index =
    hover.kind === "quayCrane" ? quayGlbIndexOfHover(hover.id) : Number(hover.id);
  if (index == null || !Number.isInteger(index)) return false;
  return active[`${hover.kind}:${index}`] != null;
}

/** 상세만 — 이벤트 신호(이름·이상 상태)는 월드 라벨/콜아웃 담당 */
function resolveInfo(
  hover: NonNullable<PortHover>,
  active: ReturnType<typeof useFailureStore.getState>["active"],
): TooltipInfo | null {
  if (hover.kind === "ship") {
    const index = Number(hover.id);
    if (!Number.isInteger(index)) return null;
    const twin = getShipTwinProfile(index);
    return {
      title: twin.vesselName,
      status: { label: shipStatusLabel(twin.status), tone: "info" },
      rows: [
        { label: "선석", value: twin.berth },
        { label: "화물", value: twin.cargo },
      ],
    };
  }

  const kind = hover.kind;
  const index = kind === "quayCrane" ? quayGlbIndexOfHover(hover.id) : Number(hover.id);
  if (index == null || !Number.isInteger(index)) return null;
  const failure = active[`${kind}:${index}`];
  const status: TooltipInfo["status"] = isFailed(active, kind, index)
    ? { label: "고장", tone: "danger" }
    : failure?.state === "warning"
      ? { label: "이상 징후", tone: "warning" }
      : { label: "정상", tone: "ok" };

  if (kind === "quayCrane") {
    const twin = getCraneTwinProfile(index);
    return {
      title: `Crane ${String(index).padStart(2, "0")}`,
      status,
      rows: [
        { label: "선박", value: twin.assignedVessel },
        { label: "작업", value: twin.containersMoved.toLocaleString() },
      ],
    };
  }

  const twin = getOverheadCraneTwinProfile(index);
  return {
    title: overheadCraneTitle(index),
    status,
    rows: [
      { label: "블록", value: overheadCraneBlockCode(index) },
      { label: "작업", value: twin.containersMoved.toLocaleString() },
    ],
  };
}

/**
 * [tooltip] 3D hover 툴팁 — 포인터 hover(ship / quayCrane / overheadCrane)만.
 * 월드 이벤트 라벨이 없는 대상의 상세(Berth/Cargo/Moves 등).
 * 위치는 pointermove 에서 DOM style 직접 갱신, React 렌더는 hover 대상·상태가 바뀔 때만.
 */
const POINTER_GAP = 16;
const pointer = { x: 0, y: 0 };

function placeTooltip(el: HTMLElement) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let x = pointer.x + POINTER_GAP;
  let y = pointer.y + POINTER_GAP;
  if (x + width > window.innerWidth) x = pointer.x - POINTER_GAP - width;
  if (y + height > window.innerHeight) y = pointer.y - POINTER_GAP - height;
  el.style.transform = `translate(${Math.max(0, Math.round(x))}px, ${Math.max(0, Math.round(y))}px)`;
}

export default function PortHoverTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<PortHover>(null);
  const active = useFailureStore((s) => s.active);
  const shipMarks = useShipArrivalStore((s) => s.marks);

  useEffect(() => {
    const sync = () => {
      const next = getPointerHover();
      setHover((prev) => (prev?.kind === next?.kind && prev?.id === next?.id ? prev : next));
    };
    sync();
    return registerPortOutlineApplier(sync);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      const el = ref.current;
      if (el) placeTooltip(el);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) placeTooltip(el);
  });

  const ticking = usePortSimStore((s) => (hover ? Math.floor(s.elapsedS) : 0));
  void ticking;
  const info =
    hover && !hasWorldSignal(hover, active, shipMarks)
      ? resolveInfo(hover, active)
      : null;

  return (
    <div
      ref={ref}
      className={info ? "pointer-events-none fixed top-0 left-0 z-[155]" : "hidden"}
    >
      {info ? <HoverTooltip title={info.title} status={info.status} rows={info.rows} /> : null}
    </div>
  );
}
