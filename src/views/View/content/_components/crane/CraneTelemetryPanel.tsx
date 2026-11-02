import InfoTip from "@/components/InfoTip";
import { CRANE_TELEMETRY as T } from "@/constants/craneTelemetry";
import type { FailureKind } from "@/constants/failureScenario";
import { INFO_TIPS } from "@/constants/infoTips";
import {
  getCraneTelemetry,
  tempLevel,
  windLevel,
  type TelemetryLevel,
} from "@/domain/craneTelemetry";
import { formatSimClock } from "@/domain/portSim";
import { usePortSim } from "@/hooks/usePortSim";
import { useDowntimeLogStore } from "@/stores/useDowntimeLogStore";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { PORT_SIM } from "@/constants/portSim";
import { cn } from "@/utils/style";
import type { ReactNode } from "react";

const LEVEL_CLASS: Record<TelemetryLevel, string> = {
  normal: "text-white",
  warn: "text-warning",
  fault: "text-danger animate-pulse",
};

function Section({ title, info, children }: { title: string; info: string; children: ReactNode }) {
  return (
    <section className="mt-md">
      <h3 className="flex items-center gap-sm text-lg font-semibold text-white">
        {title}
        <InfoTip text={info} className="text-md" />
      </h3>
      <dl className="mt-xs flex flex-col">{children}</dl>
    </section>
  );
}

function Row({ label, value, level = "normal" }: { label: string; value: string; level?: TelemetryLevel }) {
  return (
    <div className="flex items-center justify-between gap-sm border-b border-white/5 py-1 text-md">
      <dt className="text-white/60">{label}</dt>
      <dd className={cn("font-medium tabular-nums", LEVEL_CLASS[level])}>{value}</dd>
    </div>
  );
}

const temp = (c: number) => `${c.toFixed(1)} °C`;

/** 크레인 상세 — 실시간 동작·모터·환경·정비·고장 이력 */
export default function CraneTelemetryPanel({ kind, index }: { kind: FailureKind; index: number }) {
  usePortSim();
  const entries = useDowntimeLogStore((s) => s.entries);
  const origin = usePortSimStore((s) => s.startedAt);
  const t = getCraneTelemetry(kind, index);
  if (!t) return null;
  const key = `${kind}:${index}`;
  const faults = entries.filter((e) => e.key === key).slice(0, 3);
  const toSim = (ms: number) => (origin == null ? ms : origin + (ms - origin) * PORT_SIM.speed);
  const wl = windLevel(t.windMs);
  const maintLevel: TelemetryLevel = t.nextMaintH <= 24 ? "warn" : "normal";

  return (
    <div className="pb-sm">
      <Section title="실시간 동작" info={INFO_TIPS.teleMotion}>
        <Row label="현재 동작" value={t.motion} level={t.motion === "정지(고장)" ? "fault" : "normal"} />
        <Row label="호이스트 속도" value={`${t.hoistSpeed} m/min`} />
        <Row label="트롤리 속도" value={`${t.trolleySpeed} m/min`} />
        <Row label="갠트리 속도" value={`${t.gantrySpeed} m/min`} />
      </Section>
      <Section title="하중·스프레더" info={INFO_TIPS.teleLoad}>
        <Row label="현재 하중" value={t.loadT > 0 ? `${t.loadT.toFixed(1)} t` : "—"} />
        <Row label="컨테이너" value={t.containerId ?? "—"} />
        <Row label="스프레더" value={t.spreaderLocked ? "잠김(Lock)" : "해제(Unlock)"} />
      </Section>
      <Section title="모터·전력" info={INFO_TIPS.teleMotor}>
        <Row label="호이스트 모터" value={temp(t.hoistMotorC)} level={tempLevel(t.hoistMotorC)} />
        <Row label="트롤리 모터" value={temp(t.trolleyMotorC)} level={tempLevel(t.trolleyMotorC)} />
        <Row label="갠트리 모터" value={temp(t.gantryMotorC)} level={tempLevel(t.gantryMotorC)} />
        <Row label="인버터" value={temp(t.inverterC)} level={tempLevel(t.inverterC)} />
        <Row label="소비 전력" value={`${t.powerKw.toLocaleString()} kW`} />
      </Section>
      <Section title="환경·안전" info={INFO_TIPS.teleEnv}>
        <Row
          label="풍속"
          value={`${t.windMs.toFixed(1)} m/s${wl === "fault" ? " · 작업 중지 기준" : wl === "warn" ? " · 주의" : ""}`}
          level={wl}
        />
        <Row label="작업 중지 기준" value={`${T.windStopMs} m/s`} />
      </Section>
      <Section title="정비" info={INFO_TIPS.teleMaint}>
        <Row label="누적 가동" value={`${t.opHours.toLocaleString()} h`} />
        <Row label="다음 정비까지" value={`${t.nextMaintH} h`} level={maintLevel} />
      </Section>
      <Section title="최근 고장" info={INFO_TIPS.teleFaults}>
        {faults.length === 0 ? (
          <Row label="이력" value="없음" />
        ) : (
          faults.map((e) => (
            <Row
              key={e.id}
              label={formatSimClock(toSim(e.start))}
              value={`${e.cause}${e.end == null ? " · 진행 중" : ""}`}
              level={e.end == null ? "fault" : "normal"}
            />
          ))
        )}
      </Section>
    </div>
  );
}
