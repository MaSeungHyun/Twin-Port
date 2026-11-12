import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { shipStatusLabel } from "@/domain/portTwinMock";
import type { ShipOperationalStatus } from "@/domain/portTwinBase";
import type { SimShip } from "@/domain/portSim";
import { usePortSim } from "@/hooks/usePortSim";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import ProgressBar from "@/components/ui/ProgressBar";
import SearchField from "@/components/ui/SearchField";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Tag from "@/components/ui/Tag";
import { cn } from "@/utils/style";
import { FrameSlot } from "@/components/ui/PanelFrames";
import { useDetailSelection } from "../useDetailSelection";

type ListTab = "list" | "berth";
type ShipFilter = "all" | "working" | "planned" | "delayed";

function parseClock(text: string) {
  const match = text.match(/(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  return ((Number(match[1]) * 31 + Number(match[2])) * 24 + Number(match[3])) * 60 + Number(match[4]);
}

function hm(text: string) {
  const match = text.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? text;
}

function formatMinute(minute: number) {
  const day = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
}

function isWorking(status: ShipOperationalStatus) {
  return status === "loading" || status === "discharging" || status === "berthed" || status === "preparing" || status === "departing";
}

function badge(ship: SimShip): { label: string; tone: "danger" | "info" | "neutral" } {
  if (ship.delayMinutes > 0) return { label: "지연", tone: "danger" };
  if (ship.status === "loading" || ship.status === "discharging") return { label: shipStatusLabel(ship.status), tone: "info" };
  if (ship.status === "arriving") return { label: "입항 예정", tone: "info" };
  return { label: ship.status === "departed" ? "출항 완료" : shipStatusLabel(ship.status), tone: "neutral" };
}

export default function ScheduleContent() {
  const sim = usePortSim();
  const openShipDetail = useContentViewStore((s) => s.openShipDetail);
  const selectShip = useViewportStore((s) => s.selectShip);
  const [tab, setTab] = useState<ListTab>("list");
  const [filter, setFilter] = useState<ShipFilter>("all");
  const [query, setQuery] = useState("");
  const [scrub, setScrub] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const scrubbingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const selection = useDetailSelection<number>(null, () => {
    const viewport = useViewportStore.getState();
    viewport.clearShipSelection();
    viewport.clearShipDetailFocus();
  });

  const counts = useMemo(() => ({
    all: sim.ships.length,
    working: sim.ships.filter((ship) => isWorking(ship.status)).length,
    planned: sim.ships.filter((ship) => ship.status === "arriving").length,
    delayed: sim.ships.filter((ship) => ship.delayMinutes > 0).length,
  }), [sim.ships]);

  const ships = sim.ships.filter((ship) => {
    if (filter === "working" && !isWorking(ship.status)) return false;
    if (filter === "planned" && ship.status !== "arriving") return false;
    if (filter === "delayed" && ship.delayMinutes <= 0) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [ship.name, ship.berth, ship.callId].some((value) => value.toLowerCase().includes(q));
  });

  const selected = selection.key == null
    ? null
    : sim.ships.find((ship) => ship.index === selection.key) ?? null;

  const window = useMemo(() => {
    const points = sim.ships.flatMap((ship) => [parseClock(ship.eta), parseClock(ship.etd)]).filter((value): value is number => value != null);
    const now = parseClock(sim.clock);
    if (points.length === 0 && now == null) return null;
    const min = Math.min(...points, now ?? Number.POSITIVE_INFINITY) - 60;
    const max = Math.max(...points, now ?? 0) + 60;
    return { min, max: Math.max(max, min + 60), now };
  }, [sim.ships, sim.clock]);

  const berths = [...new Set(sim.ships.map((ship) => ship.berth))];
  const nowMinute = window?.now ?? null;
  const scrubMinute = window == null || scrub == null
    ? null
    : Math.min(window.max, Math.max(window.min, scrub));

  const minuteFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !window) return null;
    const span = el.clientWidth - 48;
    if (span <= 0) return window.min;
    const x = Math.min(el.clientWidth, Math.max(48, clientX - el.getBoundingClientRect().left));
    const raw = window.min + ((x - 48) / span) * (window.max - window.min);
    const snapped = Math.round(raw / 5) * 5;
    return Math.min(window.max, Math.max(window.min, snapped));
  };

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const apply = () => setTrackWidth(el.clientWidth);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [window]);

  const lineLeft = (minute: number) => {
    if (!window) return 0;
    const ratio = Math.max(0, Math.min(1, (minute - window.min) / (window.max - window.min)));
    return `calc(48px + (100% - 48px) * ${ratio})`;
  };
  const labelLift = nowMinute != null && scrubMinute != null && trackWidth > 48
    && Math.abs((scrubMinute - nowMinute) / (window!.max - window!.min)) * (trackWidth - 48) < 40;

  return (
    <>
      <FrameSlot side="left" id="schedule" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-3 pt-3 pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-medium text-dt-text">스케줄</h2>
            <span className="text-[12px] text-dt-text-3">{sim.clock}</span>
          </div>
          <SegmentedControl<ListTab>
            className="mt-3"
            value={tab}
            onChange={setTab}
            options={[
              { value: "list", label: "일정 목록" },
              { value: "berth", label: "선석별 보기" },
            ]}
          />
        </header>
        <div className="px-3 pb-2">
          <SearchField value={query} onChange={setQuery} placeholder="선박, 선석, 콜 검색" label="선박, 선석, 콜 검색" />
          <div className="mt-2 flex flex-wrap gap-1">
            {([
              ["all", `전체 ${counts.all}`],
              ["working", `작업중 ${counts.working}`],
              ["planned", `예정 ${counts.planned}`],
              ["delayed", `지연 ${counts.delayed}`],
            ] as const).map(([id, label]) => (
              <Chip key={id} pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {tab === "berth"
            ? berths.map((berth) => (
                <div key={berth} className="mb-2">
                  <p className="px-2 py-1 text-[11px] text-white/40">{berth}</p>
                  {ships.filter((ship) => ship.berth === berth).map((ship) => (
                    <ShipRow key={ship.callId} ship={ship} active={selected?.index === ship.index} onClick={() => selection.select(ship.index)} />
                  ))}
                </div>
              ))
            : ships.map((ship) => (
                <ShipRow key={ship.callId} ship={ship} active={selected?.index === ship.index} onClick={() => selection.select(ship.index)} />
              ))}
          {ships.length === 0 ? <p className="px-2 py-6 text-center text-[12px] text-white/40">해당하는 선박이 없습니다</p> : null}
        </div>
      </aside>
      </FrameSlot>

      <FrameSlot side="right" id="schedule-detail" active={selected != null && !selection.closing} size={{ width: 360, height: "fill", lift: true }} rank={1}>
      {selected ? (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-6 text-white">
          <header className="flex shrink-0 items-start justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold">{selected.name}</h2>
              <Tag tone={badge(selected).tone} className="mt-1">{badge(selected).label}</Tag>
            </div>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-3.5" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <ol className="mt-3 flex flex-col gap-2">
            {selected.schedule.map((event) => (
              <li key={event.label} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-[12px]">
                <span className={cn("size-2 rounded-full", event.complete ? "bg-dt-point" : "bg-white/25")} />
                <span className={event.complete ? "text-white" : "text-white/45"}>{event.label}</span>
                <span className="tabular-nums text-white/55">{hm(event.at)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-white/45">
              <span>작업 진행</span>
              <span className="tabular-nums text-white">{selected.progress}%</span>
            </div>
            <ProgressBar className="mt-1" value={selected.progress} tone="info" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
            <div>
              <dt className="text-white/40">양하</dt>
              <dd className="tabular-nums">{selected.discharged.toLocaleString()} / {selected.dischargeTotal.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-white/40">적재</dt>
              <dd className="tabular-nums">{selected.loaded.toLocaleString()} / {selected.loadTotal.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-white/40">선석</dt>
              <dd>{selected.berth}</dd>
            </div>
            <div>
              <dt className="text-white/40">크레인</dt>
              <dd className="truncate">{selected.craneNames.join(", ") || "—"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => openShipDetail(selected.key)}>선박 상세</Button>
            <Button tone="primary" className="flex-1" onClick={() => selectShip(selected.key)}>위치추적</Button>
          </div>
          </div>
        </aside>
      ) : null}
      </FrameSlot>

      <section className="hud-flat pointer-events-auto absolute right-[408px] bottom-[88px] left-[408px] h-[240px] max-h-[calc(100%-120px)] overflow-hidden rounded-[14px] px-3 py-2 text-white">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[12px] font-medium">선석별 일정</h2>
          <span className="text-[11px] text-white/40">{sim.clock}</span>
        </div>
        {window ? (
          <div className="relative">
            <div className="relative ml-12 h-4">
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const minute = window.min + (window.max - window.min) * t;
                const hh = Math.floor(minute / 60) % 24;
                const mm = minute % 60;
                return (
                  <span key={t} className="absolute -translate-x-1/2 text-[10px] text-white/35" style={{ left: `${t * 100}%` }}>
                    {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}
                  </span>
                );
              })}
            </div>
            <div ref={trackRef} className="relative">
              {berths.slice(0, 6).map((berth) => (
                <div key={berth} className="grid grid-cols-[40px_1fr] items-center gap-2">
                  <span className="truncate text-[10px] text-white/45">{berth}</span>
                  <div className="relative h-3 rounded-sm bg-white/14">
                    {sim.ships.filter((ship) => ship.berth === berth).map((ship) => {
                      const start = parseClock(ship.eta);
                      const end = parseClock(ship.etd);
                      if (start == null || end == null || end <= start || !window) return null;
                      const left = ((start - window.min) / (window.max - window.min)) * 100;
                      const width = ((end - start) / (window.max - window.min)) * 100;
                      return (
                        <button
                          key={ship.callId}
                          type="button"
                          title={ship.name}
                          onClick={() => selection.select(ship.index)}
                          className={cn(
                            "absolute top-0.5 h-2 rounded-sm",
                            ship.delayMinutes > 0 ? "bg-dt-danger" : "bg-dt-info",
                          )}
                          style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(2, Math.min(100 - left, width))}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              {nowMinute != null ? (
                <div
                  role={scrubMinute == null ? "slider" : undefined}
                  aria-label={scrubMinute == null ? "현재 시각" : undefined}
                  aria-valuetext={scrubMinute == null ? formatMinute(nowMinute) : undefined}
                  className={cn(
                    "absolute top-0 bottom-0 z-10 w-4 -translate-x-1/2",
                    scrubMinute == null && "cursor-ew-resize touch-none",
                    scrubMinute == null && scrubbing && "cursor-grabbing",
                    scrubMinute != null && "pointer-events-none",
                  )}
                  style={{ left: lineLeft(nowMinute) }}
                  onPointerDown={(event) => {
                    if (scrubMinute != null) return;
                    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* 합성 이벤트 */ }
                    scrubbingRef.current = true;
                    setScrubbing(true);
                    const next = minuteFromClientX(event.clientX);
                    if (next != null) setScrub(next);
                  }}
                  onPointerMove={(event) => {
                    if (!scrubbingRef.current) return;
                    const next = minuteFromClientX(event.clientX);
                    if (next != null) setScrub(next);
                  }}
                  onPointerUp={(event) => {
                    scrubbingRef.current = false;
                    setScrubbing(false);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                >
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 grid h-4 w-10 -translate-x-1/2 place-items-center rounded bg-dt-danger text-[10px] font-bold text-white">
                    {formatMinute(nowMinute)}
                  </span>
                  <span className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-dt-danger/80" />
                </div>
              ) : null}
              {scrubMinute != null ? (
                <div
                  role="slider"
                  aria-label="시간 탐색"
                  aria-valuetext={formatMinute(scrubMinute)}
                  className={cn(
                    "absolute top-0 bottom-0 z-20 w-4 -translate-x-1/2 cursor-ew-resize touch-none",
                    scrubbing && "cursor-grabbing",
                  )}
                  style={{ left: lineLeft(scrubMinute) }}
                  onPointerDown={(event) => {
                    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* 합성 이벤트 */ }
                    scrubbingRef.current = true;
                    setScrubbing(true);
                  }}
                  onPointerMove={(event) => {
                    if (!scrubbingRef.current) return;
                    const next = minuteFromClientX(event.clientX);
                    if (next != null) setScrub(next);
                  }}
                  onPointerUp={(event) => {
                    scrubbingRef.current = false;
                    setScrubbing(false);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                >
                  <span className={cn(
                    "pointer-events-none absolute bottom-full left-1/2 mb-0.5 grid h-4 w-10 -translate-x-1/2 place-items-center rounded bg-dt-info text-[10px] font-bold text-white",
                    labelLift && "-translate-y-[18px]",
                  )}>
                    {formatMinute(scrubMinute)}
                  </span>
                  <span className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-dt-info/80" />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-[12px] text-white/40">일정 시각이 없습니다</p>
        )}
      </section>
    </>
  );
}

function ShipRow({ ship, active, onClick }: { ship: SimShip; active: boolean; onClick: () => void }) {
  const tone = badge(ship);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-16 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-white/6",
        active && "bg-dt-info/12 shadow-[inset_0_0_0_1px_#3D9BFF80]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-dt-text">{ship.name}</span>
        <span className="block truncate text-[12px] text-dt-text-2">{ship.callId} · {ship.berth}</span>
      </span>
      <span className="text-right">
        <span className={cn("block text-[12px]", tone.tone === "danger" ? "text-dt-danger-bright" : tone.tone === "info" ? "text-dt-info-bright" : "text-dt-text-2")}>{tone.label}</span>
        <span className="mt-0.5 block text-[10px] tabular-nums text-dt-text-3">{hm(ship.eta)}</span>
      </span>
    </button>
  );
}
