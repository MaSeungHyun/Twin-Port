import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** "11-05 11:45" → "2026.11.05 THU" (시뮬레이션 시계 날짜, 연도는 올해) */
function dateLabel(clock: string) {
  const match = clock.match(/(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = new Date(new Date().getFullYear(), Number(match[1]) - 1, Number(match[2]));
  return `${date.getFullYear()}.${match[1]}.${match[2]} ${WEEKDAYS[date.getDay()]}`;
}

/** 선석 일정 기본 표시 범위 06:00–22:00 (라벨 2시간). 휠로 이동, Ctrl+휠로 2–24시간 사이 확대/축소 */
const GANTT_START_H = 6;
const GANTT_END_H = 22;
const GANTT_MIN_SPAN = 120;
const GANTT_MAX_SPAN = 1440;
/** 라벨 간격 후보(분). 라벨끼리 GANTT_LABEL_MIN_PX 이상 떨어지는 가장 짧은 값을 쓴다 */
const GANTT_LABEL_STEPS = [30, 60, 120, 180, 240, 360];
const GANTT_LABEL_MIN_PX = 72;
/** 휠 후 목표 범위로 따라가는 비율 (프레임당) */
const GANTT_EASE = 0.3;

/** 하루(00:00–24:00) 안의 표시 범위. start·span 은 분 */
type GanttView = { start: number; span: number };
const GANTT_DEFAULT_VIEW: GanttView = { start: GANTT_START_H * 60, span: (GANTT_END_H - GANTT_START_H) * 60 };

function clampView(view: GanttView): GanttView {
  const span = Math.min(GANTT_MAX_SPAN, Math.max(GANTT_MIN_SPAN, view.span));
  return { span, start: Math.min(1440 - span, Math.max(0, view.start)) };
}

/** 일정 막대 색: 작업 중 / 예정 / 지연 구간 */
const GANTT_LEGEND = [
  { label: "작업 중", className: "bg-dt-info" },
  { label: "예정", className: "bg-[#6B7A8A29]" },
  { label: "지연", className: "bg-[#A88A2B]" },
] as const;

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
  const [view, setView] = useState<GanttView>(GANTT_DEFAULT_VIEW);
  const viewNow = useRef<GanttView>(GANTT_DEFAULT_VIEW);
  const viewTarget = useRef<GanttView>(GANTT_DEFAULT_VIEW);
  const viewFrame = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
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

  // 표시 범위 = 현재 시뮬레이션 날짜 안의 view (기본 06:00–22:00). 범위 밖 막대는 가장자리에서 잘린다
  const window = useMemo(() => {
    const now = parseClock(sim.clock);
    const base = now ?? sim.ships.map((ship) => parseClock(ship.eta)).find((value): value is number => value != null) ?? null;
    if (base == null) return null;
    const day = Math.floor(base / 1440) * 1440;
    return { min: day + view.start, max: day + view.start + view.span, now };
  }, [sim.ships, sim.clock, view]);

  const berths = [...new Set(sim.ships.map((ship) => ship.berth))];
  // 현재 시각이 표시 범위 밖이면 현재선은 숨긴다 (탐색선도 같다)
  const nowMinute = window?.now != null && window.now >= window.min && window.now <= window.max ? window.now : null;
  const scrubMinute = window != null && scrub != null && scrub >= window.min && scrub <= window.max ? scrub : null;
  const hasWindow = window != null;

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
  }, [hasWindow]);

  // 휠 = 시간대 이동, Ctrl+휠 = 커서 시각 기준 확대/축소. passive:false 로 막아 페이지·3D 카메라·브라우저 확대가 같이 돌지 않게 한다
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const step = () => {
      const current = viewNow.current;
      const target = viewTarget.current;
      const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const done = reduce || (Math.abs(target.start - current.start) < 0.5 && Math.abs(target.span - current.span) < 0.5);
      const next = done ? target : {
        start: current.start + (target.start - current.start) * GANTT_EASE,
        span: current.span + (target.span - current.span) * GANTT_EASE,
      };
      viewNow.current = next;
      setView(next);
      viewFrame.current = done ? 0 : requestAnimationFrame(step);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const scale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1;
      const target = viewTarget.current;
      let next: GanttView;
      if (event.ctrlKey) {
        const delta = event.deltaY * scale;
        if (!delta) return;
        const span = Math.min(GANTT_MAX_SPAN, Math.max(GANTT_MIN_SPAN, target.span * Math.exp(delta * 0.0015)));
        let ratio = 0.5;
        const track = trackRef.current;
        if (track) {
          const rect = track.getBoundingClientRect();
          const width = rect.width - 48;
          if (width > 0) ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - 48) / width));
        }
        const anchor = target.start + ratio * target.span;
        next = clampView({ start: anchor - ratio * span, span });
      } else {
        // 휠 한 칸(100px) ≈ 기본 16시간 폭에서 1시간, 폭에 비례
        const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * scale;
        if (!delta) return;
        next = clampView({ start: target.start + (delta / 100) * (target.span / 16), span: target.span });
      }
      if (next.start === target.start && next.span === target.span) return;
      viewTarget.current = next;
      if (!viewFrame.current) viewFrame.current = requestAnimationFrame(step);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(viewFrame.current);
      viewFrame.current = 0;
    };
  }, []);

  const lineLeft = (minute: number) => {
    if (!window) return 0;
    const ratio = Math.max(0, Math.min(1, (minute - window.min) / (window.max - window.min)));
    return `calc(48px + (100% - 48px) * ${ratio})`;
  };
  // 라벨 간격은 확대 정도에 따라 30분–6시간. 기본 06–22 폭에서는 2시간
  const pxPerMinute = window && trackWidth > 48 ? (trackWidth - 48) / (window.max - window.min) : 1;
  const labelStep = GANTT_LABEL_STEPS.find((step) => step * pxPerMinute >= GANTT_LABEL_MIN_PX) ?? 360;
  const minorStep = Math.max(15, labelStep / 2);
  const hours: number[] = [];
  if (window) {
    for (let minute = Math.ceil(window.min / minorStep) * minorStep; minute <= window.max + 0.001; minute += minorStep) hours.push(minute);
  }
  const majorTick = (minute: number) => minute % labelStep === 0;
  const tickLabel = (minute: number) => (labelStep < 60 ? formatMinute(minute) : String(Math.floor(minute / 60) % 24).padStart(2, "0"));
  const labelLift = nowMinute != null && scrubMinute != null && trackWidth > 48
    && Math.abs((scrubMinute - nowMinute) / (window!.max - window!.min)) * (trackWidth - 48) < 40;

  return (
    <>
      <FrameSlot side="left" id="schedule" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-6 pt-[21px] pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] leading-6 font-medium text-dt-text">스케줄</h2>
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
        <div className="px-6 pb-2">
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
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
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
            <div className="min-w-0">
              <p className="text-[10px] leading-[15px] font-medium tracking-[1px] text-dt-text-3">SCHEDULE · 기항 상세</p>
              <h2 className="mt-0.5 truncate text-[20px] leading-[29px] font-medium text-dt-text">{selected.name}</h2>
              <Tag tone={badge(selected).tone} className="mt-1">{badge(selected).label}</Tag>
            </div>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-3.5" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="mt-4 text-[10px] leading-[15px] font-medium tracking-[1px] text-dt-text-3">일정</p>
          <ol className="mt-2 flex flex-col gap-2">
            {selected.schedule.map((event) => (
              <li key={event.label} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-[12px]">
                <span className={cn("size-2 rounded-full", event.complete ? "bg-dt-point" : "bg-white/25")} />
                <span className={event.complete ? "text-white" : "text-white/45"}>{event.label}</span>
                <span className="text-right text-[12px] leading-[17px] font-medium tabular-nums text-dt-text">{hm(event.at)}</span>
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

      <section ref={sectionRef} className="hud-flat pointer-events-auto absolute right-[408px] bottom-[88px] left-[408px] h-[240px] max-h-[calc(100%-120px)] overflow-hidden rounded-[14px] px-6 pt-[18px] pb-3 text-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[14px] leading-5 font-medium text-dt-text">선석 배정 일정</h2>
            <span className="truncate text-[11px] tabular-nums text-white/40">
              {dateLabel(sim.clock)}
              {window ? ` · ${formatMinute(window.min)} - ${Math.round(window.max) % 1440 === 0 ? "24:00" : formatMinute(window.max)}` : ""}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-white/60">
            {GANTT_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-[2px]", item.className)} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        {window ? (
          <div className="relative">
            <div className="relative ml-12 h-4">
              {hours.filter(majorTick).map((minute) => (
                <span
                  key={minute}
                  className="absolute -translate-x-1/2 text-[10px] tabular-nums text-white/35"
                  style={{ left: `${((minute - window.min) / (window.max - window.min)) * 100}%` }}
                >
                  {tickLabel(minute)}
                </span>
              ))}
            </div>
            <div ref={trackRef} className="relative">
              {hours.map((minute) => (
                <span
                  key={minute}
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-0 bottom-0 w-px",
                    majorTick(minute) ? "bg-white/[0.06]" : "bg-white/[0.025]",
                  )}
                  style={{ left: lineLeft(minute) }}
                />
              ))}
              {berths.slice(0, 6).map((berth) => (
                <div key={berth} className="grid h-[26px] grid-cols-[40px_1fr] items-center gap-2">
                  <span className="truncate text-[12px] leading-[17px] font-medium text-dt-text-2">{berth}</span>
                  <div className="relative h-full">
                    {sim.ships.filter((ship) => ship.berth === berth).map((ship) => {
                      const start = parseClock(ship.eta);
                      const end = parseClock(ship.etd);
                      if (start == null || end == null || end <= start || !window) return null;
                      // 06–22 범위로 잘라서 그린다
                      const from = Math.max(start, window.min);
                      const to = Math.min(end, window.max);
                      if (to <= from) return null;
                      const left = ((from - window.min) / (window.max - window.min)) * 100;
                      const width = ((to - from) / (window.max - window.min)) * 100;
                      // 지연분은 예상 이안 쪽 끝에 금색 구간으로 (보이는 범위 안만)
                      const delayFrom = Math.max(from, end - ship.delayMinutes);
                      const delayShare = ship.delayMinutes > 0 && to > delayFrom ? ((to - delayFrom) / (to - from)) * 100 : 0;
                      const active = selected?.index === ship.index;
                      return (
                        <button
                          key={ship.callId}
                          type="button"
                          title={ship.name}
                          onClick={() => selection.select(ship.index)}
                          className={cn(
                            "absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-[4px] text-left bg-dt-info/80",
                            isWorking(ship.status) ? "bg-dt-info/80" : "bg-dt-info/40",
                            active && "shadow-[inset_0_0_0_1.5px_#FFFFFFB3] bg-dt-info border-bg-dt-info",
                          )}
                          style={{ left: `${left}%`, width: `${Math.min(100 - left, Math.max(1, width))}%` }}
                        >
                          {delayShare > 0 ? (
                            <span className="absolute inset-y-0 right-0 bg-[#A88A2B]" style={{ width: `${delayShare}%` }} />
                          ) : null}
                          <span className="relative min-w-0 truncate px-1.5 text-[10px] font-semibold tracking-[0.04em] text-white uppercase">
                            {ship.name}
                          </span>
                        </button>
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
        <span className="block truncate text-[14px] leading-5 font-medium text-dt-text">{ship.name}</span>
        <span className="block truncate text-[12px] leading-[17px] text-dt-text-2">{ship.callId} · {ship.berth}</span>
      </span>
      <span className="text-right">
        <span className={cn("block text-[12px]", tone.tone === "danger" ? "text-dt-danger-bright" : tone.tone === "info" ? "text-dt-info-bright" : "text-dt-text-2")}>{tone.label}</span>
        <span className="mt-0.5 block text-[12px] leading-[17px] tabular-nums text-dt-text-3">{hm(ship.eta)}</span>
      </span>
    </button>
  );
}
