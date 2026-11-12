import {
  OPS_FAULT_LABEL,
  OPS_SHARE_LABEL,
  OPS_STATE_LABEL,
  type OpsFaultLevel,
  type OpsShareKey,
} from "@/constants/opsScenario";
import type {
  OpsConveyorLive,
  OpsEquipmentLive,
  OpsFault,
  OpsMove,
} from "@/domain/opsScenario";
import InfoTip from "@/components/InfoTip";
import { INFO_TIPS } from "@/constants/infoTips";
import type { SimCrane, SimOverheadCrane, SimShip } from "@/domain/portSim";
import { craneStatusLabel, shipStatusLabel } from "@/domain/portTwinMock";
import { usePortSim } from "@/hooks/usePortSim";
import { OVERHEAT_WARN_CAUSE } from "@/domain/overheatMonitor";
import { formatSimClock, getPortHourlyThroughput } from "@/domain/portSim";
import { failureKey, useFailureStore, type ActiveFailure } from "@/stores/useFailureStore";
import { downtimeMinutes, useDowntimeLogStore } from "@/stores/useDowntimeLogStore";
import { useOpsStore } from "@/stores/useOpsStore";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { cn } from "@/utils/style";
import type { ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

const SHARE_KEYS: OpsShareKey[] = ["run", "move", "wait", "fault"];

const SHARE_CLASS: Record<OpsShareKey, string> = {
  run: "bg-dt-ok",
  move: "bg-dt-info",
  wait: "bg-dt-warn",
  fault: "bg-dt-danger",
};

function clock(seconds: number) {
  const whole = Math.floor(Math.max(0, seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function num(value: number, digits = 0) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function stateClass(state: string) {
  if (state === "고장" || state === "정체" || state === "fault")
    return "text-dt-danger";
  if (
    state === "대기" ||
    state === "감속" ||
    state === "정지" ||
    state === "wait"
  )
    return "text-dt-warn";
  return "text-dt-info";
}

function Kpi({
  label,
  value,
  sub,
  info,
}: {
  label: string;
  value: string;
  sub: string;
  info: string;
}) {
  return (
    <div className="min-w-0 rounded-[10px] bg-white/[0.03] p-5">
      <p className="flex items-center gap-1 text-[12px] font-normal text-dt-text-2">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </p>
      <p className="mt-1 truncate text-[20px] leading-none font-light tabular-nums text-dt-text">
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] font-normal tabular-nums text-dt-text-3">{sub}</p>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
  className,
  info,
}: {
  title: string;
  info: string;
  aside?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] bg-white/[0.03] p-5",
        className,
      )}
    >
      <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 text-[16px] font-medium text-dt-text">
          {title}
          <InfoTip text={info} />
        </h3>
        {aside ? <p className="text-[12px] font-normal text-dt-text-2">{aside}</p> : null}
      </header>
      <div className="min-h-0 flex-1 scrollbar-themed overflow-auto">{children}</div>
    </section>
  );
}

function ShareBar({ share }: { share: Record<OpsShareKey, number> }) {
  const total = SHARE_KEYS.reduce((sum, key) => sum + share[key], 0);
  return (
    <div className="flex h-1.5 w-full overflow-hidden bg-white/10">
      {total > 0
        ? SHARE_KEYS.map((key) => (
            <div
              key={key}
              title={OPS_SHARE_LABEL[key]}
              className={SHARE_CLASS[key]}
              style={{ width: `${(share[key] / total) * 100}%` }}
            />
          ))
        : null}
    </div>
  );
}

function ConveyorCard({ conveyor }: { conveyor: OpsConveyorLive }) {
  return (
    <div className="rounded-[10px] bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[16px] font-medium text-dt-text">
          {conveyor.name}
        </p>
        <p className={cn("text-[14px] font-normal", stateClass(conveyor.state))}>
          {conveyor.state}
        </p>
      </div>
      <p className="mt-0.5 text-[12px] font-normal text-dt-text-2">
        {conveyor.from} → {conveyor.to}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] tabular-nums">
        <p>
          <span className="block text-dt-text-3">속도</span>
          <span className="text-[14px] font-medium text-dt-text">
            {conveyor.speed.toFixed(1)} m/s
          </span>
        </p>
        <p>
          <span className="block text-dt-text-3">대기</span>
          <span className="text-dt-text">{conveyor.queued}개</span>
        </p>
        <p>
          <span className="block text-dt-text-3">통과</span>
          <span className="text-dt-text">{conveyor.passed}회</span>
        </p>
      </div>
    </div>
  );
}

function MoveRow({ move }: { move: OpsMove }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] items-center gap-2 border-b border-white/8 py-1 text-[12px]">
      <span className="tabular-nums text-dt-text-3">{clock(move.t)}</span>
      <span className="truncate text-dt-text">{move.container}</span>
      <span className="truncate text-dt-text-2">
        {move.from} → {move.to}
      </span>
      <span className={cn("text-right", stateClass(move.status))}>
        {move.status}
      </span>
    </div>
  );
}

function faultClass(level: OpsFaultLevel) {
  if (level === "error") return "text-dt-danger";
  if (level === "warning") return "text-dt-warn";
  return "text-dt-ok";
}

function FaultRow({ fault }: { fault: OpsFault }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,0.9fr)_44px_minmax(0,1.2fr)] items-center gap-2 border-b border-white/8 py-1 text-[12px]">
      <span className="tabular-nums text-dt-text-3">{clock(fault.t)}</span>
      <span className="truncate text-dt-text">{fault.name}</span>
      <span className={faultClass(fault.level)}>{OPS_FAULT_LABEL[fault.level]}</span>
      <span className="truncate text-dt-text-2">
        {fault.message}
        {fault.active && fault.level !== "recovery" ? (
          <span className="ml-1 text-dt-text">진행</span>
        ) : null}
      </span>
    </div>
  );
}

function EquipmentRow({ item }: { item: OpsEquipmentLive }) {
  const label = OPS_STATE_LABEL[item.state];
  return (
    <tr className="border-b border-white/8 text-[12px]">
      <td className="px-2 py-1 text-dt-text">{item.name}</td>
      <td className="px-2 py-1 text-dt-text-2">{item.kind}</td>
      <td className={cn("px-sm py-xs", stateClass(item.state))}>
        {label}
        {item.cause ? (
          <span className="ml-1 text-dt-text-2">{item.cause}</span>
        ) : null}
      </td>
      <td className="px-sm py-xs tabular-nums">{item.count}</td>
      <td className="px-sm py-xs tabular-nums">{item.perHour.toFixed(1)}</td>
      <td className="px-sm py-xs tabular-nums">{num(item.utilization)}%</td>
      <td className="w-36 px-sm py-xs">
        <ShareBar share={item.share} />
      </td>
    </tr>
  );
}

function simStateClass(status: string) {
  if (status === "error") return "text-dt-danger";
  if (status === "idle" || status === "arriving" || status === "departing" || status === "preparing" || status === "berthed")
    return "text-dt-warn";
  if (status === "departed") return "text-dt-text-3";
  return "text-dt-info";
}

function Th({ heads }: { heads: string[] }) {
  return (
    <thead className="sticky top-0 z-1 bg-dt-bg text-[10px] font-medium tracking-[1px] text-dt-text-3">
      <tr>
        {heads.map((head) => (
          <th
            key={head}
            className="whitespace-nowrap border-b border-white/8 px-2 py-2 font-medium"
          >
            {head}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function statusDot(status: string) {
  if (status === "error") return "bg-dt-danger";
  if (status === "discharging" || status === "loading") return "bg-dt-info";
  if (status === "departed") return "bg-dt-text-3";
  if (status === "idle" || status === "arriving" || status === "departing" || status === "preparing" || status === "berthed")
    return "bg-dt-warn";
  return "bg-dt-ok";
}

function BerthRow({ ship }: { ship: SimShip }) {
  return (
    <tr className="border-b border-white/8 text-[12px] text-dt-text">
      <td className="whitespace-nowrap px-2 py-2">{ship.berth}</td>
      <td className="max-w-36 truncate px-2 py-2 font-medium">{ship.name}</td>
      <td className={cn("whitespace-nowrap px-2 py-2", simStateClass(ship.status))}>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", statusDot(ship.status))} />
          {shipStatusLabel(ship.status)}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <ProgressBar value={ship.progress} tone="info" className="w-[136px]" />
          <span className="w-9 text-right tabular-nums text-dt-text-2">{num(ship.progress)}%</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums">
        {num(ship.discharged)}/{num(ship.dischargeTotal)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums">
        {num(ship.loaded)}/{num(ship.loadTotal)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums">
        {ship.activeCranes}/{ship.craneNames.length}
      </td>
      <td className="px-2 py-2 tabular-nums">{num(ship.mph)}</td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-dt-text-2">{ship.eta}</td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-dt-text-2">{ship.etd}</td>
    </tr>
  );
}

function CraneRow({ crane }: { crane: SimCrane }) {
  return (
    <tr className="border-b border-white/8 text-[12px] text-dt-text">
      <td className="whitespace-nowrap px-2 py-2">{crane.name}</td>
      <td className="whitespace-nowrap px-2 py-2 text-dt-text-2">{crane.berth}</td>
      <td className="max-w-36 truncate px-2 py-2 text-dt-text-2">{crane.vessel}</td>
      <td className={cn("whitespace-nowrap px-2 py-2", simStateClass(crane.status))}>
        {craneStatusLabel(crane.status)}
        {crane.cause ? <span className="ml-1 text-dt-text-2">{crane.cause}</span> : null}
      </td>
      <td className="px-2 py-2 tabular-nums">{num(crane.moves)}</td>
      <td className="px-2 py-2 tabular-nums">{num(crane.mph)}</td>
      <td className="px-2 py-2 tabular-nums">{num(crane.utilization)}%</td>
    </tr>
  );
}

function OhcRow({ crane }: { crane: SimOverheadCrane }) {
  const pct = crane.capacity > 0 ? (crane.stored / crane.capacity) * 100 : 0;
  return (
    <tr className="border-b border-white/8 text-[12px] text-dt-text">
      <td className="whitespace-nowrap px-2 py-2">{crane.name}</td>
      <td className="whitespace-nowrap px-2 py-2 text-dt-text-2">{crane.block}</td>
      <td className={cn("whitespace-nowrap px-2 py-2", simStateClass(crane.status))}>
        {craneStatusLabel(crane.status)}
        {crane.cause ? <span className="ml-1 text-dt-text-2">{crane.cause}</span> : null}
      </td>
      <td className="px-2 py-2 tabular-nums">{num(crane.moves)}</td>
      <td className="px-2 py-2 tabular-nums">{num(crane.mph, 1)}</td>
      <td className="px-2 py-2 tabular-nums">{num(crane.utilization)}%</td>
      <td className="w-40 px-2 py-2">
        <div className="flex items-center gap-2">
          <ProgressBar
            value={pct}
            tone={pct >= 90 ? "danger" : pct >= 70 ? "warn" : "info"}
            className="min-w-0 flex-1"
          />
          <span className="w-16 text-right tabular-nums">
            {num(crane.stored)}/{num(crane.capacity)}
          </span>
        </div>
      </td>
    </tr>
  );
}

/** 탭 공통 레이아웃 — 흰 글씨 기준, 세로 스크롤 */
function TabBody({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-themed flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-6 text-dt-text">
      {children}
    </div>
  );
}

function TabTitle({ title, info, aside }: { title: string; info: string; aside?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-md">
      <h2 className="flex items-center gap-1 text-[16px] font-medium text-dt-text">
        {title}
        <InfoTip text={info} />
      </h2>
      {aside ? <p className="text-[12px] font-normal tabular-nums text-dt-text-2">{aside}</p> : null}
    </div>
  );
}

function SimClock() {
  const sim = usePortSim();
  return (
    <>
      {sim.clock} · 관제 기준 {sim.shiftStart} · {sim.running ? "진행" : "정지"}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-[14px] font-normal text-dt-text-2">{text}</p>;
}

function BerthTable({ ships }: { ships: SimShip[] }) {
  return (
    <>
      <table className="w-full border-collapse text-left">
        <Th heads={["선석", "선박", "상태", "진행", "양하", "적재", "크레인", "개/h", "ETA", "ETD"]} />
        <tbody>
          {ships.map((ship) => (
            <BerthRow key={ship.key} ship={ship} />
          ))}
        </tbody>
      </table>
      {ships.length === 0 ? <Empty text="선박 데이터를 불러오는 중입니다" /> : null}
    </>
  );
}

function CraneTable({ cranes }: { cranes: SimCrane[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <Th heads={["크레인", "선석", "선박", "상태", "처리", "개/h", "가동률"]} />
      <tbody>
        {cranes.map((crane) => (
          <CraneRow key={crane.index} crane={crane} />
        ))}
      </tbody>
    </table>
  );
}

function ScenarioKpis() {
  const data = useOpsStore((s) => s.snapshot);
  if (!data) return null;
  const k = data.kpi;
  return (
    <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-6">
      <Kpi label="처리량" info={INFO_TIPS.opsThroughput} value={`${num(k.throughputPerHour)}개/h`} sub="반출 완료" />
      <Kpi label="양하" info={INFO_TIPS.opsInbound} value={`${num(k.inbound)}개`} sub="안벽 수취" />
      <Kpi label="반출" info={INFO_TIPS.opsOutbound} value={`${num(k.outbound)}개`} sub="게이트 통과" />
      <Kpi label="가동률" info={INFO_TIPS.opsUtilization} value={`${num(k.utilization)}%`} sub="작업+이동" />
      <Kpi label="컨베이어 대기" info={INFO_TIPS.opsQueued} value={`${num(k.queued)}개`} sub="세 구간 합" />
      <Kpi label="리드타임" info={INFO_TIPS.opsLeadTime} value={`${k.leadTimeMin.toFixed(1)}분`} sub="선박 → 블록" />
    </div>
  );
}

function ScenarioPending() {
  const running = useOpsStore((s) => s.running);
  return (
    <Empty
      text={running ? "시나리오를 시작하는 중입니다." : "관제를 시작하면 양하 시나리오가 수집됩니다."}
    />
  );
}

const CARD = "flex min-h-0 flex-col overflow-hidden rounded-[10px] bg-white/[0.03] p-5";

function OverviewKpi({
  label,
  value,
  unit,
  aside,
}: {
  label: string;
  value: string;
  unit: string;
  aside: string;
}) {
  return (
    <div className="relative min-h-[88px] min-w-0 overflow-hidden rounded-[10px] bg-white/[0.03] p-5">
      <p className="text-[12px] font-normal text-dt-text-2">{label}</p>
      <p className="absolute top-5 right-5 max-w-[120px] truncate text-right text-[12px] font-normal text-dt-text-3">
        {aside}
      </p>
      <p className="mt-2 truncate text-[28px] leading-none font-light tabular-nums text-dt-text">
        {value}
        {unit ? <span className="ml-1 text-[12px] font-normal text-dt-text-3">{unit}</span> : null}
      </p>
    </div>
  );
}

/** 막대에 호버하면 시각·처리량 툴팁 (InfoTip 과 같은 스타일) */
function HourlyChart() {
  const bars = getPortHourlyThroughput(12);
  const peak = Math.max(1, ...bars.map((bar) => bar.moves));
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      <div className="flex min-h-0 flex-1 items-end gap-2">
        {bars.map((bar) => (
          <TooltipPrimitive.Root key={`${bar.label}-${bar.current ? "now" : "past"}`}>
            <TooltipPrimitive.Trigger asChild>
              <div
                aria-label={`${bar.label}:00 ${num(bar.moves)}개`}
                className="group flex min-w-0 flex-1 cursor-default flex-col items-center gap-2"
              >
                <div className="flex h-[180px] w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-8 rounded-sm transition-[filter,box-shadow] duration-150 group-hover:brightness-125 group-hover:shadow-[0_0_0_1px_#ffffff40]",
                      bar.current ? "bg-dt-point" : "bg-dt-info/50",
                    )}
                    style={{ height: `${Math.max(4, (bar.moves / peak) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium tracking-[1px] text-dt-text-3 transition-colors group-hover:text-dt-text">{bar.label}</span>
              </div>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={6}
                collisionPadding={8}
                className="z-[1000] rounded-lg bg-dt-bg/92 px-3 py-2 text-[12px] leading-snug font-normal tabular-nums text-dt-text shadow-[inset_0_0_0_2px_#ffffff1a]"
              >
                {bar.label}:00 · {num(bar.moves)}개{bar.current ? " (진행 중)" : ""}
                <TooltipPrimitive.Arrow className="fill-dt-bg" />
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        ))}
      </div>
    </TooltipPrimitive.Provider>
  );
}

function CraneDonut({
  active,
  idle,
  caution,
  fault,
}: {
  active: number;
  idle: number;
  caution: number;
  fault: number;
}) {
  const parts = [
    { label: "가동", value: active, color: "var(--color-dt-ok)" },
    { label: "대기", value: idle, color: "var(--color-dt-off)" },
    { label: "주의", value: caution, color: "var(--color-dt-warn)" },
    { label: "고장", value: fault, color: "var(--color-dt-danger)" },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const rate = Math.round((active / total) * 100);
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex min-h-0 flex-1 items-center gap-6">
      <svg viewBox="0 0 120 120" className="aspect-square h-auto w-full max-w-40 shrink-0">
        <g transform="rotate(-90 60 60)">
          {parts.filter((part) => part.value > 0).map((part) => {
            const length = (part.value / total) * circ;
            const node = (
              <circle
                key={part.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={part.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circ - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return node;
          })}
        </g>
        <text x="60" y="58" textAnchor="middle" fill="var(--color-dt-text)" fontSize="20" fontWeight="300">
          {rate}%
        </text>
        <text x="60" y="76" textAnchor="middle" fill="var(--color-dt-text-3)" fontSize="10">
          가동률
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-3">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2">
            <span className="size-4 rounded-sm" style={{ background: part.color }} />
            <span className="text-[14px] font-normal text-dt-text">{part.label}</span>
            <span className="ml-auto text-[14px] font-medium tabular-nums text-dt-text">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AlarmTone = "danger" | "warning" | "ok";

type OverviewAlarm = {
  id: string;
  tone: AlarmTone;
  tag: string;
  title: string;
  sub: string;
  time: string;
};

// TODO: 실데이터 연결 — 고장·주의·복구가 모두 없을 때만 표시
const MOCK_ALARMS: OverviewAlarm[] = [
  { id: "mock-1", tone: "danger", tag: "고장", title: "QC-07 스프레더", sub: "유압 이상", time: "11:42" },
  { id: "mock-2", tone: "warning", tag: "주의", title: "OHC-B26", sub: "주행 모터 온도", time: "11:38" },
  { id: "mock-3", tone: "ok", tag: "복구", title: "QC-56", sub: "정상 가동 재개", time: "11:21" },
];

function OverviewAlarms() {
  const history = useDowntimeLogStore((s) => s.entries);
  const faults = useOpsStore((s) => s.snapshot)?.faults ?? [];
  const live: OverviewAlarm[] = [
    ...history.slice(0, 6).map((entry) => ({
      id: entry.id,
      tone: (entry.end == null ? "danger" : "ok") as AlarmTone,
      tag: entry.end == null ? "고장" : "복구",
      title: entry.name,
      sub: entry.cause,
      time: formatSimClock(entry.start, false),
    })),
    ...faults.slice(0, 6).map((fault) => ({
      id: fault.id,
      tone: (fault.level === "error" ? "danger" : fault.level === "warning" ? "warning" : "ok") as AlarmTone,
      tag: fault.level === "error" ? "고장" : fault.level === "warning" ? "주의" : "복구",
      title: fault.name,
      sub: fault.message,
      time: clock(fault.t),
    })),
  ];
  const items = live.length > 0 ? live.slice(0, 8) : MOCK_ALARMS;
  return (
    <ul className="scrollbar-themed flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <Tag tone={item.tone}>{item.tag}</Tag>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-dt-text">{item.title}</p>
            <p className="truncate text-[12px] font-normal text-dt-text-2">{item.sub}</p>
          </div>
          <span className="shrink-0 text-[12px] font-normal tabular-nums text-dt-text-3">{item.time}</span>
        </li>
      ))}
    </ul>
  );
}

/** 안벽 크레인 도넛. 주의는 과열 경고만, 고장 상태와 겹치면 고장으로만 센다 */
function quayDonutCounts(cranes: SimCrane[], active: Record<string, ActiveFailure>) {
  let working = 0;
  let idle = 0;
  let caution = 0;
  let fault = 0;
  for (const crane of cranes) {
    const failure = active[failureKey("quayCrane", crane.index)];
    const overheatWarn = failure?.state === "warning" && failure.cause === OVERHEAT_WARN_CAUSE;
    if (crane.status === "error") fault += 1;
    else if (overheatWarn) caution += 1;
    else if (crane.status === "idle") idle += 1;
    else working += 1;
  }
  return { active: working, idle, caution, fault };
}

/** 개요 — KPI 6, 시간대 처리량, 크레인 도넛, 선석 표, 알람 */
export function OverviewTab() {
  const sim = usePortSim();
  const failures = useFailureStore((s) => s.active);
  const k = sim.kpi;
  const donut = quayDonutCounts(sim.cranes, failures);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid shrink-0 grid-cols-3 gap-3 min-[1280px]:grid-cols-6">
        <OverviewKpi label="선석 작업" value={`${k.shipsWorking}/${k.shipsTotal}`} unit="척" aside="양하·적재 중" />
        <OverviewKpi label="관제 누적" value={num(k.shiftMoves)} unit="개" aside="안벽 크레인 합" />
        <OverviewKpi label="생산성" value={num(k.mph)} unit="개/h" aside="가동 크레인 합" />
        <OverviewKpi label="양하/적재" value={`${num(k.discharged)}/${num(k.loaded)}`} unit="" aside="기항 중 선박" />
        <OverviewKpi label="크레인 가동" value={`${k.cranesActive}/${k.cranesTotal}`} unit="대" aside={`고장 ${k.cranesError} · 대기 ${k.cranesIdle}`} />
        <OverviewKpi label="야드 장치율" value={num(k.yardPct)} unit="%" aside={`${num(k.yardStored)}/${num(k.yardCapacity)}`} />
      </div>
      <div className="grid shrink-0 grid-cols-1 gap-4 min-[1280px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={cn(CARD, "min-h-[284px]")}>
          <h3 className="mb-3 shrink-0 text-[16px] font-medium text-dt-text">시간대별 처리량</h3>
          <HourlyChart />
        </section>
        <section className={cn(CARD, "min-h-[284px]")}>
          <h3 className="mb-3 shrink-0 text-[16px] font-medium text-dt-text">안벽 크레인 가동</h3>
          <CraneDonut active={donut.active} idle={donut.idle} caution={donut.caution} fault={donut.fault} />
        </section>
      </div>
      {/* 남은 높이를 채우고, 선석 현황·알람·고장은 카드 안에서만 스크롤 (대시보드 전체 스크롤 방지) */}
      <div className="grid min-h-[320px] flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 min-[1280px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[1280px]:grid-rows-[minmax(0,1fr)]">
        <section className={CARD}>
          <h3 className="mb-3 shrink-0 text-[16px] font-medium text-dt-text">선석 현황</h3>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-auto">
            <BerthTable ships={sim.ships} />
          </div>
        </section>
        <section className={CARD}>
          <h3 className="mb-3 shrink-0 text-[16px] font-medium text-dt-text">알람·고장</h3>
          <OverviewAlarms />
        </section>
      </div>
    </div>
  );
}

/** 선석·선박 */
export function BerthTab() {
  const sim = usePortSim();
  return (
    <TabBody>
      <TabTitle title="선석·선박" info={INFO_TIPS.berthStatus} aside={<SimClock />} />
      <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-4">
        <Kpi label="선석 작업" value={`${sim.kpi.shipsWorking}/${sim.kpi.shipsTotal}척`} sub="양하·적재 중" info={INFO_TIPS.kpiBerth} />
        <Kpi label="양하 / 적재" value={`${num(sim.kpi.discharged)} / ${num(sim.kpi.loaded)}`} sub="기항 중 선박" info={INFO_TIPS.kpiDischargeLoad} />
        <Kpi label="선석 생산성" value={`${num(sim.kpi.mph)}개/h`} sub="가동 크레인 합" info={INFO_TIPS.kpiMph} />
        <Kpi label="관제 누적" value={`${num(sim.kpi.shiftMoves)}개`} sub="관제 시작 이후" info={INFO_TIPS.kpiShiftMoves} />
      </div>
      <Section title="선석 현황" aside={`${sim.ships.length}개 선석 · 작업 ${sim.kpi.shipsWorking}척`} info={INFO_TIPS.berthStatus} className="min-h-[360px] flex-1">
        <BerthTable ships={sim.ships} />
      </Section>
    </TabBody>
  );
}

/** 안벽 크레인 */
export function QuayCraneTab() {
  const sim = usePortSim();
  const k = sim.kpi;
  return (
    <TabBody>
      <TabTitle title="안벽 크레인" info={INFO_TIPS.craneStatus} aside={<SimClock />} />
      <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-4">
        <Kpi label="크레인 가동" value={`${k.cranesActive}/${k.cranesTotal}대`} sub={`대기 ${k.cranesIdle}`} info={INFO_TIPS.kpiCranes} />
        <Kpi label="고장" value={`${k.cranesError}대`} sub="고장 시나리오 반영" info={INFO_TIPS.kpiCranes} />
        <Kpi label="생산성" value={`${num(k.mph)}개/h`} sub="가동 크레인 합" info={INFO_TIPS.kpiMph} />
        <Kpi label="관제 누적" value={`${num(k.shiftMoves)}개`} sub="안벽 크레인 합" info={INFO_TIPS.kpiShiftMoves} />
      </div>
      <Section title="안벽 크레인 현황" aside={`${sim.cranes.length}대`} info={INFO_TIPS.craneStatus} className="min-h-[360px] flex-1">
        <CraneTable cranes={sim.cranes} />
      </Section>
    </TabBody>
  );
}

/** 야드·블록 — 오버헤드 크레인 표 (블록 점유 그리드는 MonitoringOverlay 가 아래에 붙임) */
export function YardSummary() {
  const sim = usePortSim();
  const k = sim.kpi;
  return (
    <div className="flex shrink-0 flex-col gap-4 p-6 pb-0 text-dt-text">
      <TabTitle title="야드·블록" info={INFO_TIPS.kpiYard} aside={<SimClock />} />
      <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-4">
        <Kpi label="야드 장치율" value={`${num(k.yardPct)}%`} sub="슬롯 대비 장치" info={INFO_TIPS.kpiYard} />
        <Kpi label="장치 컨테이너" value={`${num(k.yardStored)}개`} sub={`전체 ${num(k.yardCapacity)}슬롯`} info={INFO_TIPS.kpiYard} />
        <Kpi label="OHC 가동률" value={`${num(k.ohcUtilization)}%`} sub={`${sim.overheadCranes.length}대 평균`} info={INFO_TIPS.overheadCraneList} />
        <Kpi label="OHC 처리" value={`${num(sim.overheadCranes.reduce((a, c) => a + c.moves, 0))}개`} sub="관제 누적" info={INFO_TIPS.overheadCraneList} />
      </div>
      <Section title="오버헤드 크레인 현황" aside={`${sim.overheadCranes.length}대`} info={INFO_TIPS.overheadCraneList} className="h-[260px] shrink-0">
        <table className="w-full border-collapse text-left">
          <Th heads={["크레인", "블록", "상태", "처리", "개/h", "가동률", "장치"]} />
          <tbody>
            {sim.overheadCranes.map((crane) => (
              <OhcRow key={crane.index} crane={crane} />
            ))}
          </tbody>
        </table>
      </Section>
      <h3 className="flex items-center gap-1 text-[16px] font-medium text-dt-text">
        블록 점유
        <InfoTip text={INFO_TIPS.blockList} />
      </h3>
    </div>
  );
}

/** 컨베이어·양하 시나리오 */
export function ScenarioTab() {
  const data = useOpsStore((s) => s.snapshot);
  const running = useOpsStore((s) => s.running);
  return (
    <TabBody>
      <TabTitle
        title={data?.title ?? "양하 시나리오"}
        info={INFO_TIPS.opsScenario}
        aside={data ? `${clock(data.elapsed)} · ${data.cycle}사이클 · ${running ? "진행" : "정지"}` : undefined}
      />
      {!data ? (
        <ScenarioPending />
      ) : (
        <>
          <ScenarioKpis />
          <div className="grid h-[420px] shrink-0 gap-md xl:grid-cols-2">
            <Section title="컨베이어" info={INFO_TIPS.conveyor} aside="안벽 → 야드 → 게이트" className="max-h-full">
              <div className="grid gap-sm">
                {data.conveyors.map((conveyor) => (
                  <ConveyorCard key={conveyor.id} conveyor={conveyor} />
                ))}
              </div>
            </Section>
            <Section title="이동 내역" info={INFO_TIPS.moves} aside="최근 구간" className="max-h-full">
              <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] gap-2 border-b border-white/8 bg-dt-bg pb-1 text-[10px] font-medium tracking-[1px] text-dt-text-3">
                <span>시각</span>
                <span>컨테이너</span>
                <span>구간</span>
                <span className="text-right">상태</span>
              </div>
              {data.moves.map((move) => (
                <MoveRow key={move.id} move={move} />
              ))}
            </Section>
          </div>
          <Section title="장비" info={INFO_TIPS.equipment} aside="작업 · 이동 · 대기 · 고장" className="h-[300px] shrink-0">
            <table className="w-full border-collapse text-left">
              <Th heads={["장비", "종류", "상태", "처리", "개/h", "가동률", "시간"]} />
              <tbody>
                {data.equipment.map((item) => (
                  <EquipmentRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </TabBody>
  );
}

/** 알람·고장 — 시나리오 장비 오류 + 고장 상태 크레인 */
export function FaultTab() {
  const sim = usePortSim();
  const data = useOpsStore((s) => s.snapshot);
  const history = useDowntimeLogStore((s) => s.entries);
  const now = Date.now();
  const down = [
    ...sim.cranes.filter((c) => c.status === "error"),
    ...sim.overheadCranes.filter((c) => c.status === "error"),
  ];
  return (
    <TabBody>
      <TabTitle title="알람·고장" info={INFO_TIPS.faults} aside={<SimClock />} />
      <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-3">
        <Kpi label="고장 장비" value={`${down.length}대`} sub="안벽·오버헤드 크레인" info={INFO_TIPS.kpiCranes} />
        <Kpi label="오류 기록" value={`${data?.faults.length ?? 0}건`} sub="양하 시나리오" info={INFO_TIPS.faults} />
        <Kpi label="진행 중" value={`${data?.faults.filter((f) => f.active && f.level !== "recovery").length ?? 0}건`} sub="미복구" info={INFO_TIPS.faults} />
      </div>
      <Section title="고장 장비" info={INFO_TIPS.kpiCranes} aside={`${down.length}대`} className="min-h-[140px] flex-[2]">
        {down.length === 0 ? (
          <Empty text="고장 상태 장비가 없습니다" />
        ) : (
          <ul className="flex flex-col">
            {down.map((c) => (
              <li key={c.name} className="flex justify-between gap-2 border-b border-white/8 py-2 text-[14px]">
                <span className="text-dt-text">{c.name}</span>
                <span className="text-dt-danger">
                  고장{c.cause ? <span className="ml-1 text-dt-text-2">{c.cause}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title="다운타임 이력"
        info={INFO_TIPS.downtime}
        aside={`${history.length}건 · 진행 ${history.filter((e) => e.end == null).length}`}
        className="min-h-[160px] flex-[3]"
      >
        <div className="sticky top-0 z-1 grid grid-cols-[minmax(0,1fr)_88px_88px_52px_minmax(0,1.2fr)] gap-2 border-b border-white/8 bg-dt-bg pb-1 text-[10px] font-medium tracking-[1px] text-dt-text-3">
          <span>장비</span>
          <span>시작</span>
          <span>종료</span>
          <span>시간</span>
          <span>원인</span>
        </div>
        {history.length === 0 ? (
          <Empty text="다운타임 이력이 없습니다" />
        ) : (
          history.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[minmax(0,1fr)_88px_88px_52px_minmax(0,1.2fr)] gap-2 border-b border-white/8 py-2 text-[12px] tabular-nums"
            >
              <span className="truncate text-dt-text">{e.name}</span>
              <span className="text-dt-text-2">{formatSimClock(e.start)}</span>
              <span className={e.end == null ? "text-dt-danger" : "text-dt-text-2"}>
                {e.end == null ? "진행 중" : formatSimClock(e.end)}
              </span>
              <span className="text-dt-text">{downtimeMinutes(e, now)}m</span>
              <span className="truncate text-dt-text-2">{e.cause}</span>
            </div>
          ))
        )}
      </Section>
      <Section title="기기별 오류" info={INFO_TIPS.faults} aside="이상 · 고장 · 복구" className="min-h-[160px] flex-[3]">
        <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,0.9fr)_44px_minmax(0,1.2fr)] gap-2 border-b border-white/8 bg-dt-bg pb-1 text-[10px] font-medium tracking-[1px] text-dt-text-3">
          <span>시각</span>
          <span>기기</span>
          <span>단계</span>
          <span>내용</span>
        </div>
        {!data || data.faults.length === 0 ? (
          <Empty text="아직 오류가 없습니다" />
        ) : (
          data.faults.map((fault) => <FaultRow key={fault.id} fault={fault} />)
        )}
      </Section>
    </TabBody>
  );
}
