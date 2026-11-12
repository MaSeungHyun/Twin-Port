import toastMockData from "@/data/toast_mock.json";
import { useHudUiStore } from "@/stores/hud";
import { useFailureStore } from "@/stores/useFailureStore";
import { useViewportStore } from "@/stores/viewport";
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import { useMemo, useState } from "react";

type AlarmFilter = "all" | "error" | "warning" | "success";

type AlarmLevel = Exclude<AlarmFilter, "all">;

type AlarmRow = {
  id: string;
  level: AlarmLevel;
  title: string;
  message?: string;
  createdAt: string;
};

const FILTERS: { id: AlarmFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "error", label: "긴급" },
  { id: "warning", label: "주의" },
  { id: "success", label: "복구" },
];

const LEVEL_BADGE: Record<AlarmLevel, string> = {
  error: "bg-[#F0434B]/15 text-[#FF6B78]",
  warning: "bg-[#E0A020]/15 text-[#F5C451]",
  success: "bg-[#1F9D6A]/15 text-[#3DDC97]",
};

const LEVEL_LABEL: Record<AlarmLevel, string> = {
  error: "긴급",
  warning: "주의",
  success: "복구",
};

function asLevel(level: string): AlarmLevel {
  if (level === "error" || level === "danger") return "error";
  if (level === "warning") return "warning";
  if (level === "success") return "success";
  return "success";
}

function clock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function useAlarmRows() {
  const failureEvents = useFailureStore((s) => s.events);
  return useMemo<AlarmRow[]>(() => {
    const live = failureEvents.map((event) => ({
      id: event.id,
      level: asLevel(event.level),
      title: event.title,
      message: event.message,
      createdAt: event.createdAt,
    }));
    const mock = toastMockData.map((item) => ({
      id: item.id,
      level: asLevel(item.level),
      title: item.title,
      message: item.message,
      createdAt: item.createdAt,
    }));
    return [...live, ...mock];
  }, [failureEvents]);
}

export default function Alarm() {
  const alarmOpen = useHudUiStore((s) => s.alarmOpen);
  const toggleAlarm = useHudUiStore((s) => s.toggleAlarm);
  const started = useViewportStore((s) => s.monitoringStarted);
  const introOpen = useViewportStore((s) => s.introOpen);
  const live = started && !introOpen;
  // 배지 = 지금 진행 중인 알람(주의·고장) 수. 복구(safe) 는 세지 않는다. 0 이면 숨김, 100 이상은 99+
  const activeCount = useFailureStore((s) =>
    Object.values(s.active).reduce((n, f) => (f.state === "safe" ? n : n + 1), 0),
  );
  const badge = live && activeCount > 0 ? (activeCount > 99 ? "99+" : String(activeCount)) : null;

  return (
    <button
      type="button"
      aria-label="알림"
      aria-pressed={live && alarmOpen}
      onClick={() => { if (live) toggleAlarm(); }}
      className={cn(
        "relative grid size-10 place-items-center rounded-lg text-white/75 hover:bg-[#2A3544]",
        live && alarmOpen && "bg-white/10 text-white",
      )}
    >
      <Icon icon="Bell" className="size-5" />
      {badge ? (
        <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#F0484A] px-1 text-[10px] leading-none font-bold tabular-nums text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function AlarmPanel() {
  const rows = useAlarmRows();
  const [filter, setFilter] = useState<AlarmFilter>("all");
  const [ackAt, setAckAt] = useState<number | null>(null);

  const pending = rows.filter((row) => ackAt == null || new Date(row.createdAt).getTime() > ackAt);
  const shown = filter === "all" ? pending : pending.filter((row) => row.level === filter);

  return (
    <aside className="flex h-full max-h-[calc(100dvh-112px-var(--toast-lift,0px))] w-full flex-col overflow-hidden text-white">
      <header className="flex shrink-0 items-center justify-between gap-2 px-6 pt-6 pb-3">
        <h2 className="text-[16px] font-medium text-[#F2F5F8]">알람</h2>
        <button
          type="button"
          onClick={() => setAckAt(Date.now())}
          className="text-[12px] text-[#9AA8B6] hover:text-white"
        >
          모두 확인
        </button>
      </header>
      <div className="flex shrink-0 gap-3 px-6 pb-3">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] text-[#9AA8B6] hover:text-white",
              filter === item.id && "bg-white/8 text-[#F2F5F8]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
        {shown.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-white/40">표시할 알람이 없습니다</p>
        ) : (
          shown.map((row) => (
            <div key={row.id} className="flex items-start gap-2 border-b border-white/8 px-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px]", LEVEL_BADGE[row.level])}>
                    {LEVEL_LABEL[row.level]}
                  </span>
                  <p className="truncate text-[13px] font-medium">{row.title}</p>
                </div>
                {row.message ? <p className="mt-0.5 truncate text-[11px] text-white/45">{row.message}</p> : null}
              </div>
              <time className="shrink-0 text-[22px] leading-none font-light tabular-nums text-[#F2F5F8]">{clock(row.createdAt)}</time>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => setFilter("all")}
        className="px-6 py-4 text-center text-[12px] text-[#9AA8B6] hover:text-white"
      >
        전체 알람 보기
      </button>
    </aside>
  );
}
