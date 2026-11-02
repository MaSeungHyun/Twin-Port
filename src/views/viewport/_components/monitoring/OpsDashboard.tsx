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
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/35 px-md py-sm">
      <p className="truncate text-md text-text-secondary">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      <p className="truncate text-md tabular-nums text-text-secondary">{sub}</p>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
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
        <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
        {aside ? <p className="text-md text-text-secondary">{aside}</p> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
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
        <p className="text-xl font-semibold text-text-primary">
          {conveyor.name}
        </p>
        <p className={cn("text-lg", stateClass(conveyor.state))}>
          {conveyor.state}
        </p>
      </div>
      <p className="mt-0.5 text-lg text-text-secondary">
        {conveyor.from} → {conveyor.to}
      </p>
      <div className="mt-sm grid grid-cols-3 gap-sm text-lg tabular-nums">
        <p>
          <span className="block text-text-secondary">속도</span>
          <span className="text-text-primary text-xl">
            {conveyor.speed.toFixed(1)} m/s
          </span>
        </p>
        <p>
          <span className="block text-text-secondary">대기</span>
          <span className="text-text-primary">{conveyor.queued}개</span>
        </p>
        <p>
          <span className="block text-text-secondary">통과</span>
          <span className="text-text-primary">{conveyor.passed}회</span>
        </p>
      </div>
    </div>
  );
}

function MoveRow({ move }: { move: OpsMove }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] items-center gap-sm border-b border-white/5 py-xs text-md">
      <span className="tabular-nums text-text-secondary">{clock(move.t)}</span>
      <span className="truncate text-text-primary">{move.container}</span>
      <span className="truncate text-text-secondary">
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
      <span className="tabular-nums text-text-secondary">{clock(fault.t)}</span>
      <span className="truncate text-text-primary">{fault.name}</span>
      <span className={faultClass(fault.level)}>{OPS_FAULT_LABEL[fault.level]}</span>
      <span className="truncate text-text-secondary">
        {fault.message}
        {fault.active && fault.level !== "recovery" ? (
          <span className="ml-xs text-text-primary">진행</span>
        ) : null}
      </span>
    </div>
  );
}

function EquipmentRow({ item }: { item: OpsEquipmentLive }) {
  const label = OPS_STATE_LABEL[item.state];
  return (
    <tr className="border-b border-white/5 text-lg">
      <td className="px-sm py-xs text-text-primary">{item.name}</td>
      <td className="px-sm py-xs text-text-secondary">{item.kind}</td>
      <td className={cn("px-sm py-xs", stateClass(item.state))}>
        {label}
        {item.cause ? (
          <span className="ml-xs text-text-secondary">{item.cause}</span>
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

export default function OpsDashboard() {
  const running = useOpsStore((s) => s.running);
  const data = useOpsStore((s) => s.snapshot);

  if (!data) {
    return (
      <p className="px-md py-xl text-center text-lg text-text-secondary">
        {running
          ? "시나리오를 시작하는 중입니다."
          : "관제를 시작하면 양하 시나리오가 수집됩니다."}
      </p>
    );
  }

  const k = data.kpi;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-md overflow-hidden p-md">
      <div className="flex shrink-0 items-baseline justify-between gap-md">
        <h2 className="text-xl font-semibold text-text-primary">
          {data.title}
        </h2>
        <p className="text-md tabular-nums text-text-secondary">
          {clock(data.elapsed)} · {data.cycle}사이클 ·{" "}
          {running ? "진행" : "정지"}
        </p>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-sm xl:grid-cols-6">
        <Kpi
          label="처리량"
          value={`${num(k.throughputPerHour)}개/h`}
          sub="반출 완료"
        />
        <Kpi label="양하" value={`${num(k.inbound)}개`} sub="안벽 수취" />
        <Kpi label="반출" value={`${num(k.outbound)}개`} sub="게이트 통과" />
        <Kpi label="가동률" value={`${num(k.utilization)}%`} sub="작업+이동" />
        <Kpi
          label="컨베이어 대기"
          value={`${num(k.queued)}개`}
          sub="세 구간 합"
        />
        <Kpi
          label="리드타임"
          value={`${num(k.leadTimeS)}초`}
          sub="선박 → 블록"
        />
      </div>

      <div className="grid min-h-0 flex-[5] gap-md xl:grid-cols-2">
        <Section
          title="컨베이어"
          aside="안벽 → 야드 → 게이트"
          className="max-h-full"
        >
          <div className="grid gap-sm">
            {data.conveyors.map((conveyor) => (
              <ConveyorCard key={conveyor.id} conveyor={conveyor} />
            ))}
          </div>
        </Section>
        <Section title="이동 내역" aside="최근 구간" className="max-h-full">
          <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,1.1fr)_minmax(0,1.4fr)_72px] gap-sm border-b border-white/10 bg-foreground pb-xs text-md text-text-secondary">
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

      <div className="grid min-h-0 flex-[4] gap-md xl:grid-cols-2">
      <Section
        title="장비"
        aside="작업 · 이동 · 대기 · 고장"
        className="max-h-full"
      >
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-1 bg-foreground text-md text-text-secondary">
            <tr>
              {["장비", "종류", "상태", "처리", "개/h", "가동률", "시간"].map(
                (head) => (
                  <th
                    key={head}
                    className="border-b border-white/10 px-sm py-xs font-medium"
                  >
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.equipment.map((item) => (
              <EquipmentRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="기기별 오류" aside="이상 · 고장 · 복구" className="max-h-full">
        <div className="sticky top-0 z-1 grid grid-cols-[52px_minmax(0,0.9fr)_44px_minmax(0,1.2fr)] gap-sm border-b border-white/10 bg-foreground pb-xs text-md text-text-secondary">
          <span>시각</span>
          <span>기기</span>
          <span>단계</span>
          <span>내용</span>
        </div>
        {data.faults.length === 0 ? (
          <p className="py-md text-center text-lg text-text-secondary">아직 오류가 없습니다</p>
        ) : (
          data.faults.map((fault) => <FaultRow key={fault.id} fault={fault} />)
        )}
      </Section>
      </div>
    </div>
  );
}
