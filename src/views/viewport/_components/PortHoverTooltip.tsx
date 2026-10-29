import { getPointerHover, registerPortOutlineApplier, type PortHover } from "@/domain/hoverOutline";
import { quayGlbIndexOfHover } from "@/domain/hoverTooltip";
import {
  getOverheadCraneTwinProfile,
  overheadCraneBlockCode,
  overheadCraneTitle,
} from "@/domain/overheadCraneTwin";
import { getCraneTwinProfile, getShipTwinProfile, shipStatusLabel } from "@/domain/portTwinMock";
import { isFailed, useFailureStore } from "@/stores/useFailureStore";
import { cn } from "@/utils/style";
import { useEffect, useRef, useState } from "react";

type TooltipInfo = {
  title: string;
  status: { label: string; tone: "ok" | "fail" | "warn" | "info" };
  rows: { label: string; value: string }[];
};

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
        { label: "Berth", value: twin.berth },
        { label: "Cargo", value: twin.cargo },
      ],
    };
  }

  const kind = hover.kind;
  const index = kind === "quayCrane" ? quayGlbIndexOfHover(hover.id) : Number(hover.id);
  if (index == null || !Number.isInteger(index)) return null;
  const failure = active[`${kind}:${index}`];
  const status: TooltipInfo["status"] = isFailed(active, kind, index)
    ? { label: "고장", tone: "fail" }
    : failure?.state === "warning"
      ? { label: "이상 징후", tone: "warn" }
      : { label: "정상", tone: "ok" };

  if (kind === "quayCrane") {
    const twin = getCraneTwinProfile(index);
    return {
      title: `Crane ${String(index).padStart(2, "0")}`,
      status,
      rows: [
        { label: "Vessel", value: twin.assignedVessel },
        failure ? { label: "Cause", value: failure.cause } : { label: "Moves", value: twin.containersMoved.toLocaleString() },
      ],
    };
  }

  const twin = getOverheadCraneTwinProfile(index);
  return {
    title: overheadCraneTitle(index),
    status,
    rows: [
      { label: "Block", value: overheadCraneBlockCode(index) },
      failure ? { label: "Cause", value: failure.cause } : { label: "Moves", value: twin.containersMoved.toLocaleString() },
    ],
  };
}

const TONE_CLASS: Record<TooltipInfo["status"]["tone"], string> = {
  ok: "text-success",
  fail: "text-danger animate-pulse",
  warn: "text-warning",
  info: "text-cyber",
};

/**
 * [tooltip] 3D hover 툴팁 — 포인터 hover(ship / quayCrane / overheadCrane)만.
 * 위치는 pointermove 에서 DOM style 직접 갱신, React 렌더는 hover 대상·고장 상태가 바뀔 때만.
 */
export default function PortHoverTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<PortHover>(null);
  const active = useFailureStore((s) => s.active);

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
      const el = ref.current;
      if (el) el.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 18}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const info = hover ? resolveInfo(hover, active) : null;

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none fixed top-0 left-0 z-[155] min-w-52 border border-cyber/30 bg-background/80 px-md py-sm shadow-[0_8px_30px_rgba(0,0,0,0.45),0_0_18px_rgba(0,232,255,0.08)] backdrop-blur-md",
        !info && "hidden",
        info?.status.tone === "fail" && "border-danger/60",
      )}
    >
      {info ? (
        <>
          <div className="flex items-center justify-between gap-md">
            <p className="truncate text-lg font-semibold text-text-primary">{info.title}</p>
            <span className={cn("shrink-0 text-lg font-semibold", TONE_CLASS[info.status.tone])}>
              {info.status.label}
            </span>
          </div>
          {info.rows.map((row) => (
            <div key={row.label} className="mt-0.5 flex justify-between gap-md text-base">
              <span className="text-text-secondary">{row.label}</span>
              <span className="truncate text-text-primary">{row.value}</span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
