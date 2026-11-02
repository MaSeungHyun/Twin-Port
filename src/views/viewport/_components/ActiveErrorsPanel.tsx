import InfoTip from "@/components/InfoTip";
import { CRANE_TELEMETRY as T } from "@/constants/craneTelemetry";
import { INFO_TIPS } from "@/constants/infoTips";
import { PORT_SIM } from "@/constants/portSim";
import { windAt } from "@/domain/craneTelemetry";
import { equipmentName, focusEquipment } from "@/domain/failureScenario";
import { formatSimClock } from "@/domain/portSim";
import { useFailureStore, type ActiveFailure } from "@/stores/useFailureStore";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";

function hash(text: string) {
  let x = 0;
  for (let i = 0; i < text.length; i += 1) x = (x * 31 + text.charCodeAt(i)) >>> 0;
  return x;
}

/** 원인 문구의 (E-xxxx) 코드, 없으면 장비 종류 + 원인 해시로 고정 코드 */
function errorCode(f: ActiveFailure) {
  const m = /\((E-[A-Z0-9-]+)\)/.exec(f.cause);
  if (m) return m[1]!;
  const prefix = f.kind === "quayCrane" ? "QC" : "YC";
  return `E-${prefix}${String((hash(f.cause) % 900) + 100)}`;
}

function cleanCause(cause: string) {
  return cause.replace(/\s*\(E-[A-Z0-9-]+\)/, "");
}

function elapsedLabel(min: number) {
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
}

/** 뷰포트 우하단 — 진행 중 경고·고장 목록(상세를 열지 않아도 보임). 카메라는 클릭할 때만 이동 */
export default function ActiveErrorsPanel() {
  const monitoringStarted = useViewportStore((s) => s.monitoringStarted);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const active = useFailureStore((s) => s.active);
  const elapsedS = usePortSimStore((s) => s.elapsedS);
  const origin = usePortSimStore((s) => s.startedAt);
  if (!monitoringStarted || monitorMode) return null;

  const now = origin == null ? Date.now() : origin + elapsedS * 1000;
  const toSim = (ms: number) => (origin == null ? ms : origin + (ms - origin) * PORT_SIM.speed);
  const items = Object.values(active)
    .filter((f) => f.state === "failure" || f.state === "warning")
    .sort((a, b) => (a.state === b.state ? b.since - a.since : a.state === "failure" ? -1 : 1));
  const h = PORT_SIM.warmHours + (elapsedS * PORT_SIM.speed) / 3600;
  const wind = windAt(h);
  const windAlert = wind >= T.windWarnMs;
  const faults = items.filter((f) => f.state === "failure").length;
  const total = items.length + (windAlert ? 1 : 0);

  return (
    <div className="pointer-events-auto absolute right-4 bottom-20 z-20 w-[340px] rounded-md border border-white/20 bg-[#000000b3] text-white shadow-lg backdrop-blur-sm select-none">
      <div className="flex items-center justify-between gap-sm border-b border-white/10 px-md py-xs">
        <h3 className="flex items-center gap-sm text-lg font-semibold">
          진행 중 에러
          <InfoTip text={INFO_TIPS.activeErrors} className="text-md" side="left" />
        </h3>
        <span className={cn("text-md tabular-nums", faults > 0 ? "text-danger" : total > 0 ? "text-warning" : "text-white/60")}>
          {total === 0 ? "정상" : `고장 ${faults} · 경고 ${total - faults}`}
        </span>
      </div>
      {total > 0 ? (
        <ul className="max-h-56 scrollbar-themed overflow-y-auto overscroll-contain py-xs">
          {windAlert ? (
            <li className="flex items-start gap-sm px-md py-1 text-md">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", wind >= T.windStopMs ? "bg-danger" : "bg-warning")} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">항만 전체 · {wind >= T.windStopMs ? "E-WD02" : "E-WD01"}</p>
                <p className="truncate text-white/60">
                  풍속 {wind.toFixed(1)} m/s {wind >= T.windStopMs ? "· 작업 중지 기준 초과" : "· 주의"}
                </p>
              </div>
            </li>
          ) : null}
          {items.map((f) => {
            const fault = f.state === "failure";
            const startSim = toSim(f.since);
            const mins = Math.max(0, Math.round((toSim(now) - startSim) / 60000));
            return (
              <li key={`${f.kind}:${f.index}`}>
                <button
                  type="button"
                  onClick={() => focusEquipment(f.kind, f.index)}
                  className="flex w-full items-start gap-sm px-md py-1 text-left text-md hover:bg-white/5"
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", fault ? "animate-pulse bg-danger" : "bg-warning")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-sm">
                      <span className="truncate font-medium">{equipmentName(f.kind, f.index)}</span>
                      <span className={cn("shrink-0 tabular-nums", fault ? "text-danger" : "text-warning")}>
                        {errorCode(f)}
                      </span>
                    </p>
                    <p className="truncate text-white/60">
                      {cleanCause(f.cause)} · {formatSimClock(startSim, false)} · {elapsedLabel(mins)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
