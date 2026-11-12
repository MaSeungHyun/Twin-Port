/* eslint-disable react-refresh/only-export-components -- Toaster 호스트 + toaster API 공존 */
import Icon from "@/components/Icon";
import { useHudUiStore } from "@/stores/hud";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import type { icons } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const TOASTER_Z_INDEX = 45;
const VISIBLE_LIMIT = 3;
/** 주의·복구·안내는 6초 뒤 자동으로 닫힌다. 긴급은 복구 토스트(같은 id)로 바뀌거나 닫을 때까지 유지 */
const AUTO_CLOSE_MS = 6000;

export type ToasterType = "success" | "info" | "warning" | "error";

type ToastCardProps = {
  title: string;
  message?: string;
  /** 윗줄 등급 뒤에 붙는 "11:42 · CRANE" */
  meta: string;
  border: string;
  surface: string;
  iconStyle: string;
  icon: keyof typeof icons;
  level: string;
  onClick?: () => void;
  onTrack?: () => void;
  onDismiss: () => void;
};

/**
 * type별 스타일 — 여기서만 수정.
 * border: 1.5px 테두리 색, surface: 남색 카드 위에 같은 색 옅은 틴트, iconStyle: 윗줄(아이콘·등급·시각·분류) 색
 */
export const TOASTER_TYPE_STYLE: Record<
  ToasterType,
  {
    border: string;
    surface: string;
    iconStyle: string;
    icon: keyof typeof icons;
    level: string;
  }
> = {
  success: {
    border: "border-[#14D99B]",
    surface: "[background:linear-gradient(#14D99B14,#14D99B14),#0A1219F2]",
    iconStyle: "stroke-[#3DE0AE]! text-[#3DE0AE]",
    icon: "CircleCheck",
    level: "복구",
  },
  info: {
    border: "border-[#3D8BFF]",
    surface: "[background:linear-gradient(#3D8BFF14,#3D8BFF14),#0A1219F2]",
    iconStyle: "stroke-[#7EB6FF]! text-[#7EB6FF]",
    icon: "Info",
    level: "안내",
  },
  warning: {
    border: "border-[#FFB020]",
    surface: "[background:linear-gradient(#FFB02014,#FFB02014),#0A1219F2]",
    iconStyle: "stroke-[#FFC24D]! text-[#FFC24D]",
    icon: "CircleAlert",
    level: "주의",
  },
  error: {
    border: "border-[#F0484A]",
    surface: "[background:linear-gradient(#F0484A1A,#F0484A1A),#0A1219F2]",
    iconStyle: "stroke-[#FF6B6E]! text-[#FF6B6E]",
    icon: "TriangleAlert",
    level: "긴급",
  },
};

function ToastCard({
  title,
  message,
  meta,
  border,
  surface,
  iconStyle,
  icon,
  level,
  onClick,
  onTrack,
  onDismiss,
}: ToastCardProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-center gap-3 rounded-lg border-[1.5px] py-3 pr-3 pl-4 shadow-[0_8px_24px_#00000059]",
        border,
        surface,
      )}
    >
      <div
        className={cn("min-w-0 flex-1 select-none", onClick && "cursor-pointer")}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
      >
        <p className={cn("flex items-center gap-1.5 text-[12px] leading-4 font-medium tabular-nums", iconStyle)}>
          <Icon icon={icon} className="size-3.5 shrink-0" />
          <span className="truncate">{meta ? `${level} · ${meta}` : level}</span>
        </p>
        <p className="mt-1 truncate text-[14px] leading-5 font-bold text-white">{title}</p>
        {message ? <p className="mt-0.5 truncate text-[12px] text-white/60">{message}</p> : null}
      </div>
      {onTrack ? (
        <button
          type="button"
          onClick={onTrack}
          className="h-8 shrink-0 rounded-md border border-[#F0484A] bg-[#5C1B20] px-3 text-[12px] font-medium text-[#FFE1E1] transition-colors hover:bg-[#74222A]"
        >
          추적
        </button>
      ) : null}
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={onDismiss}
        className="grid size-6 shrink-0 place-items-center rounded text-white/50 hover:bg-white/10 hover:text-white"
      >
        <Icon icon="X" className="size-4" />
      </button>
    </div>
  );
}

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type ToasterOptions = {
  id?: string | number;
  duration?: number;
  message?: string;
  /** 본문 클릭 시 (예: 장비 위치로 카메라 이동) */
  onClick?: () => void;
  /** 지정 시 추적 버튼(좌측 목록 클릭과 같은 Tracking). 긴급 토스트는 눌러도 복구될 때까지 남는다 */
  onTrack?: () => void;
  /** 윗줄 시각(ms, HH:MM 로 표시). 없으면 지금 */
  at?: number;
  /** 윗줄 끝 분류·부가 정보 (예: "CRANE", "다운타임 16분") */
  meta?: string;
};

type ToastEntry = {
  sid: string;
  key?: string | number;
  type: ToasterType;
  title: string;
  message?: string;
  meta: string;
  onClick?: () => void;
  onTrack?: () => void;
  timer: number | null;
  exiting?: boolean;
};

function normalizeOptions(messageOrOptions?: string | ToasterOptions): ToasterOptions {
  if (typeof messageOrOptions === "string") return { message: messageOrOptions };
  return messageOrOptions ?? {};
}

const liveToastIds = new Map<string | number, string>();
let toastSeq = 0;
let entries: ToastEntry[] = [];
const listeners = new Set<() => void>();

function commit(next: ToastEntry[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function forgetKey(entry: ToastEntry) {
  if (entry.key != null && liveToastIds.get(entry.key) === entry.sid) liveToastIds.delete(entry.key);
  if (entry.timer != null) window.clearTimeout(entry.timer);
}

function removeSid(sid: string) {
  const found = entries.find((entry) => entry.sid === sid);
  if (!found || found.exiting) return;
  forgetKey(found);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    commit(entries.filter((entry) => entry.sid !== sid));
    return;
  }
  found.exiting = true;
  commit([...entries]);
  window.setTimeout(() => {
    commit(entries.filter((entry) => entry.sid !== sid));
  }, 200);
}

function canToast() {
  const viewport = useViewportStore.getState();
  if (!viewport.monitoringStarted || viewport.introOpen || viewport.hudHidden) return false;
  if (useHudUiStore.getState().alarmOpen) return false;
  return true;
}

function show(type: ToasterType, title: string, messageOrOptions?: string | ToasterOptions) {
  if (!canToast()) return "";
  const detailOpen = useHudUiStore.getState().rightDetailHolders > 0;
  if (detailOpen && type !== "error") {
    useHudUiStore.getState().bumpUnseenAlarms();
    return "";
  }

  const options = normalizeOptions(messageOrOptions);
  const key = options.id;
  const sid = `${key == null ? "toast" : String(key)}#${++toastSeq}`;
  let next = entries;
  if (key != null) {
    const prev = liveToastIds.get(key);
    if (prev != null) {
      const old = next.find((entry) => entry.sid === prev);
      if (old) forgetKey(old);
      next = next.filter((entry) => entry.sid !== prev);
    }
    liveToastIds.set(key, sid);
  }

  const entry: ToastEntry = {
    sid,
    key,
    type,
    title,
    message: options.message,
    meta: [hhmm(options.at ?? Date.now()), options.meta].filter(Boolean).join(" · "),
    onClick: options.onClick,
    onTrack: options.onTrack,
    timer: type === "error" ? null : window.setTimeout(() => removeSid(sid), AUTO_CLOSE_MS),
  };
  commit([...next, entry]);
  return sid;
}

function suppressNonUrgent() {
  const kept: ToastEntry[] = [];
  let hidden = 0;
  for (const entry of entries) {
    if (entry.type === "error") kept.push(entry);
    else {
      forgetKey(entry);
      hidden += 1;
    }
  }
  if (hidden > 0) useHudUiStore.getState().bumpUnseenAlarms(hidden);
  if (hidden > 0) commit(kept);
}

/** 어디서든 `toaster.warning("제목", "메시지")` 형태로 호출 */
export const toaster = {
  success: (title: string, messageOrOptions?: string | ToasterOptions) =>
    show("success", title, messageOrOptions),
  info: (title: string, messageOrOptions?: string | ToasterOptions) =>
    show("info", title, messageOrOptions),
  warning: (title: string, messageOrOptions?: string | ToasterOptions) =>
    show("warning", title, messageOrOptions),
  error: (title: string, messageOrOptions?: string | ToasterOptions) =>
    show("error", title, messageOrOptions),
  dismiss: (id?: string | number) => {
    if (id == null) {
      for (const entry of entries) forgetKey(entry);
      liveToastIds.clear();
      commit([]);
      return;
    }
    const sid = liveToastIds.get(id) ?? id;
    liveToastIds.delete(id);
    removeSid(String(sid));
  },
};

function publishToastLift(height: number) {
  const lift = height > 0 ? `${Math.ceil(height) + 16}px` : "0px";
  document.documentElement.style.setProperty("--toast-lift", lift);
}

/** App 등 트리에 한 번 마운트. 위치는 항상 오른쪽 24, 아래 24 */
export default function Toaster() {
  const alarmOpen = useHudUiStore((s) => s.alarmOpen);
  const detailHolders = useHudUiStore((s) => s.rightDetailHolders);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const items = useSyncExternalStore(subscribe, () => entries, () => entries);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alarmOpen) toaster.dismiss();
  }, [alarmOpen]);

  useEffect(() => {
    if (detailHolders > 0) suppressNonUrgent();
  }, [detailHolders]);

  useEffect(() => {
    const el = stackRef.current;
    if (!el) {
      publishToastLift(0);
      return;
    }
    const apply = () => publishToastLift(el.getBoundingClientRect().height);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => () => publishToastLift(0), []);

  const visible = items.slice(-VISIBLE_LIMIT);
  const extra = items.length - visible.length;

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={stackRef}
      className="pointer-events-none fixed right-6 bottom-6 flex w-[360px] flex-col items-end gap-2"
      style={{ zIndex: monitorMode ? 200 : TOASTER_Z_INDEX }}
    >
      {extra > 0 ? (
        <button
          type="button"
          className="pointer-events-auto h-8 rounded-lg bg-dt-bg/90 px-3 text-[12px] font-medium text-dt-text shadow-[inset_0_0_0_1px_#ffffff14]"
          onClick={() => useHudUiStore.getState().setAlarmOpen(true)}
        >
          +{extra}개 더보기
        </button>
      ) : null}
      {visible.map((entry) => (
        <div key={entry.sid} className={cn("w-full", entry.exiting ? "presence-toast-out" : "presence-toast-in")}>
          <ToastCard
            title={entry.title}
            message={entry.message}
            meta={entry.meta}
            onClick={entry.onClick}
            onTrack={entry.onTrack}
            onDismiss={() => removeSid(entry.sid)}
            {...TOASTER_TYPE_STYLE[entry.type]}
          />
        </div>
      ))}
    </div>,
    document.body,
  );
}
