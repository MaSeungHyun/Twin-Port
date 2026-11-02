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
import { formatSimClock } from "@/domain/portSim";
import { downtimeMinutes, useDowntimeLogStore } from "@/stores/useDowntimeLogStore";
import { useOpsStore } from "@/stores/useOpsStore";
import { cn } from "@/utils/style";
import type { ReactNode } from "react";

const SHARE_KEYS: OpsShareKey[] = ["run", "move", "wait", "fault"];

const SHARE_CLASS: Record<OpsShareKey, string> = {
  run: "bg-primary",
  move: "bg-cyber-dim",
  wait: "bg-warning",
  fault: "bg-danger",
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
    return "text-danger";
  if (
    state === "대기" ||
    state === "감속" ||
    state === "정지" ||
    state === "wait"
  )
    return "text-warning";
  return "text-primary";
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
    <div className="min-w-0 rounded-md border border-white/10 bg-black/35 px-md py-sm">
      <p className="flex items-center gap-xs text-md text-white/60">
        <span className="truncate">{label}</span>
        <InfoTip text={info} />
      </p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-white">
        {value}
      </p>
      <p className="truncate text-md tabular-nums text-white/60">{sub}</p>
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
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-white/10 bg-foreground/80 p-md",
        className,
      )}
    >
      <header className="mb-sm flex shrink-0 items-center justify-between gap-sm">
        <h3 className="flex items-center gap-xs text-xl font-semibold text-white">
          {title}
          <InfoTip text={info} />
        </h3>
        {aside ? <p className="text-md text-white/60">{aside}</p> : null}
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
    <div className="rounded-md border border-white/10 px-md py-sm">
      <div className="flex items-center justify-between gap-sm">
        <p className="text-xl font-semibold text-white">
          {conveyor.name}
        </p>
        <p className={cn("text-lg", stateClass(conveyor.state))}>
          {conveyor.state}
        </p>
      </div>
      <p className="mt-0.5 text-lg text-white/60">
        {conveyor.from} → {conveyor.to}
      </p>
      <div className="mt-sm grid grid-cols-3 gap-sm text-lg tabular-nums">
        <p>
          <span className="block text-white/60">속도</span>
          <span className="text-white text-xl">
            {conveyor.speed.toFixed(1)} m/s
          </span>
        </p>
        <p>
          <span className="block text-white/60">대기</span>
          <span className="text-white">{conveyor.queued}개</span>
        </p>
        <p>
          <span className="block text-white/60">통과</span>
          <span className="text-white">{conveyor.passed}회</span>
        </p>
      </div>
    </div>
  );
}

function MoveRow({ move }: { move: OpsMove }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] items-center gap-sm border-b border-white/5 py-xs text-md">
      <span className="tabular-nums text-white/60">{clock(move.t)}</span>
      <span className="truncate text-white">{move.container}</span>
      <span className="truncate text-white/60">
        {move.from} → {move.to}
      </span>
      <span className={cn("text-right", stateClass(move.status))}>
        {move.status}
      </span>
    </div>
  );
}

function faultClass(level: OpsFaultLevel) {
  if (level === "error") return "text-danger";
  if (level === "warning") return "text-warning";
  return "text-primary";
}

function FaultRow({ fault }: { fault: OpsFault }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,0.9fr)_44px_minmax(0,1.2fr)] items-center gap-sm border-b border-white/5 py-xs text-lg">
      <span className="tabular-nums text-white/60">{clock(fault.t)}</span>
      <span className="truncate text-white">{fault.name}</span>
      <span className={faultClass(fault.level)}>{OPS_FAULT_LABEL[fault.level]}</span>
      <span className="truncate text-white/60">
        {fault.message}
        {fault.active && fault.level !== "recovery" ? (
          <span className="ml-xs text-white">진행</span>
        ) : null}
      </span>
    </div>
  );
}

function EquipmentRow({ item }: { item: OpsEquipmentLive }) {
  const label = OPS_STATE_LABEL[item.state];
  return (
    <tr className="border-b border-white/5 text-lg">
      <td className="px-sm py-xs text-white">{item.name}</td>
      <td className="px-sm py-xs text-white/60">{item.kind}</td>
      <td className={cn("px-sm py-xs", stateClass(item.state))}>
        {label}
        {item.cause ? (
          <span className="ml-xs text-white/60">{item.cause}</span>
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
  if (status === "error") return "text-danger";
  if (status === "idle" || status === "arriving" || status === "departing")
    return "text-warning";
  return "text-primary";
}

function Th({ heads }: { heads: string[] }) {
  return (
    <thead className="sticky top-0 z-1 bg-foreground text-md text-white/60">
      <tr>
        {heads.map((head) => (
          <th
            key={head}
            className="whitespace-nowrap border-b border-white/10 px-sm py-xs font-medium"
          >
            {head}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function BerthRow({ ship }: { ship: SimShip }) {
  return (
    <tr className="border-b border-white/5 text-lg">
      <td className="whitespace-nowrap px-sm py-xs text-white">{ship.berth}</td>
      <td className="max-w-40 truncate px-sm py-xs text-white">{ship.name}</td>
      <td className={cn("whitespace-nowrap px-sm py-xs", simStateClass(ship.status))}>
        {shipStatusLabel(ship.status)}
      </td>
      <td className="w-32 px-sm py-xs">
        <div className="flex items-center gap-xs">
          <div className="h-1.5 flex-1 overflow-hidden bg-white/10">
            <div className="h-full bg-primary" style={{ width: `${ship.progress}%` }} />
          </div>
          <span className="w-9 text-right tabular-nums">{num(ship.progress)}%</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-sm py-xs tabular-nums">
        {num(ship.discharged)}/{num(ship.dischargeTotal)}
      </td>
      <td className="whitespace-nowrap px-sm py-xs tabular-nums">
        {num(ship.loaded)}/{num(ship.loadTotal)}
      </td>
      <td className="whitespace-nowrap px-sm py-xs tabular-nums">
        {ship.activeCranes}/{ship.craneNames.length}
      </td>
      <td className="px-sm py-xs tabular-nums">{num(ship.mph)}</td>
      <td className="whitespace-nowrap px-sm py-xs tabular-nums text-white/60">{ship.eta}</td>
      <td className="whitespace-nowrap px-sm py-xs tabular-nums text-white/60">{ship.etd}</td>
    </tr>
  );
}

function CraneRow({ crane }: { crane: SimCrane }) {
  return (
    <tr className="border-b border-white/5 text-lg">
      <td className="whitespace-nowrap px-sm py-xs text-white">{crane.name}</td>
      <td className="whitespace-nowrap px-sm py-xs text-white/60">{crane.berth}</td>
      <td className="max-w-36 truncate px-sm py-xs text-white/60">{crane.vessel}</td>
      <td className={cn("whitespace-nowrap px-sm py-xs", simStateClass(crane.status))}>
        {craneStatusLabel(crane.status)}
        {crane.cause ? <span className="ml-xs text-white/60">{crane.cause}</span> : null}
      </td>
      <td className="px-sm py-xs tabular-nums">{num(crane.moves)}</td>
      <td className="px-sm py-xs tabular-nums">{num(crane.mph)}</td>
      <td className="px-sm py-xs tabular-nums">{num(crane.utilization)}%</td>
    </tr>
  );
}

function OhcRow({ crane }: { crane: SimOverheadCrane }) {
  const pct = crane.capacity > 0 ? (crane.stored / crane.capacity) * 100 : 0;
  return (
    <tr className="border-b border-white/5 text-lg">
      <td className="whitespace-nowrap px-sm py-xs text-white">{crane.name}</td>
      <td className="whitespace-nowrap px-sm py-xs text-white/60">{crane.block}</td>
      <td className={cn("whitespace-nowrap px-sm py-xs", simStateClass(crane.status))}>
        {craneStatusLabel(crane.status)}
        {crane.cause ? <span className="ml-xs text-white/60">{crane.cause}</span> : null}
      </td>
      <td className="px-sm py-xs tabular-nums">{num(crane.moves)}</td>
      <td className="px-sm py-xs tabular-nums">{num(crane.mph, 1)}</td>
      <td className="px-sm py-xs tabular-nums">{num(crane.utilization)}%</td>
      <td className="w-36 px-sm py-xs">
        <div className="flex items-center gap-xs">
          <div className="h-1.5 flex-1 overflow-hidden bg-white/10">
            <div
              className={cn("h-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
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
    <div className="flex min-h-0 flex-1 flex-col gap-md scrollbar-themed overflow-y-auto overscroll-contain p-md text-white">
      {children}
    </div>
  );
}

function TabTitle({ title, info, aside }: { title: string; info: string; aside?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-md">
      <h2 className="flex items-center gap-xs text-xl font-semibold text-white">
        {title}
        <InfoTip text={info} />
      </h2>
      {aside ? <p className="text-md tabular-nums text-white/60">{aside}</p> : null}
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
  return <p className="py-md text-center text-lg text-white/60">{text}</p>;
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

function PortKpis() {
  const k = usePortSim().kpi;
  return (
    <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-6">
      <Kpi label="선석 작업" value={`${k.shipsWorking}/${k.shipsTotal}척`} sub="양하·적재 중" info={INFO_TIPS.kpiBerth} />
      <Kpi label="관제 누적" value={`${num(k.shiftMoves)}개`} sub="안벽 크레인 합" info={INFO_TIPS.kpiShiftMoves} />
      <Kpi label="생산성" value={`${num(k.mph)}개/h`} sub="가동 크레인 합" info={INFO_TIPS.kpiMph} />
      <Kpi label="양하 / 적재" value={`${num(k.discharged)} / ${num(k.loaded)}`} sub="기항 중 선박" info={INFO_TIPS.kpiDischargeLoad} />
      <Kpi label="크레인 가동" value={`${k.cranesActive}/${k.cranesTotal}대`} sub={`고장 ${k.cranesError} · 대기 ${k.cranesIdle}`} info={INFO_TIPS.kpiCranes} />
      <Kpi label="야드 장치율" value={`${num(k.yardPct)}%`} sub={`${num(k.yardStored)}/${num(k.yardCapacity)} · OHC ${num(k.ohcUtilization)}%`} info={INFO_TIPS.kpiYard} />
    </div>
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

/** 개요 — 항만 KPI + 선석·크레인 요약 + 양하 시나리오 KPI */
export function OverviewTab() {
  const sim = usePortSim();
  const data = useOpsStore((s) => s.snapshot);
  return (
    <TabBody>
      <TabTitle title="항만 운영 현황" info={INFO_TIPS.portOverview} aside={<SimClock />} />
      <PortKpis />
      <div className="grid h-[320px] shrink-0 gap-md xl:grid-cols-[3fr_2fr]">
        <Section title="선석 현황" aside={`${sim.ships.length}개 선석`} info={INFO_TIPS.berthStatus} className="max-h-full">
          <BerthTable ships={sim.ships} />
        </Section>
        <Section title="안벽 크레인 현황" aside={`${sim.cranes.length}대`} info={INFO_TIPS.craneStatus} className="max-h-full">
          <CraneTable cranes={sim.cranes} />
        </Section>
      </div>
      <TabTitle
        title={data ? `${data.title} 요약` : "양하 시나리오 요약"}
        info={INFO_TIPS.opsScenario}
        aside={data ? `${clock(data.elapsed)} · ${data.cycle}사이클` : undefined}
      />
      {data ? <ScenarioKpis /> : <ScenarioPending />}
    </TabBody>
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
    <div className="flex shrink-0 flex-col gap-md p-md pb-0 text-white">
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
      <h3 className="flex items-center gap-xs text-xl font-semibold text-white">
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
              <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] gap-sm border-b border-white/10 bg-foreground pb-xs text-md text-white/60">
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
      <Section title="고장 장비" info={INFO_TIPS.kpiCranes} aside={`${down.length}대`} className="h-[220px] shrink-0">
        {down.length === 0 ? (
          <Empty text="고장 상태 장비가 없습니다" />
        ) : (
          <ul className="flex flex-col">
            {down.map((c) => (
              <li key={c.name} className="flex justify-between gap-sm border-b border-white/5 py-xs text-lg">
                <span className="text-white">{c.name}</span>
                <span className="text-danger">
                  고장{c.cause ? <span className="ml-xs text-white/60">{c.cause}</span> : null}
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
        className="h-[280px] shrink-0"
      >
        <div className="sticky top-0 z-1 grid grid-cols-[minmax(0,1fr)_88px_88px_52px_minmax(0,1.2fr)] gap-sm border-b border-white/10 bg-foreground pb-xs text-md text-white/60">
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
              className="grid grid-cols-[minmax(0,1fr)_88px_88px_52px_minmax(0,1.2fr)] gap-sm border-b border-white/5 py-xs text-lg tabular-nums"
            >
              <span className="truncate text-white">{e.name}</span>
              <span className="text-white/60">{formatSimClock(e.start)}</span>
              <span className={e.end == null ? "text-danger" : "text-white/60"}>
                {e.end == null ? "진행 중" : formatSimClock(e.end)}
              </span>
              <span className="text-white">{downtimeMinutes(e, now)}m</span>
              <span className="truncate text-white/60">{e.cause}</span>
            </div>
          ))
        )}
      </Section>
      <Section title="기기별 오류" info={INFO_TIPS.faults} aside="이상 · 고장 · 복구" className="min-h-[300px] flex-1">
        <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,0.9fr)_44px_minmax(0,1.2fr)] gap-sm border-b border-white/10 bg-foreground pb-xs text-md text-white/60">
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
