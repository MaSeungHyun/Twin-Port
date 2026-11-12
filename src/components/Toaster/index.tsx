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
const AUTO_CLOSE_MS = 5000;

export type ToasterType = "success" | "info" | "warning" | "error";

type ToastCardProps = {
  title: string;
  message?: string;
  border: string;
  iconStyle: string;
  icon: keyof typeof icons;
  level: string;
  onClick?: () => void;
  onTrack?: () => void;
  onDismiss: () => void;
};

/** type별 스타일 — 여기서만 수정 */
export const TOASTER_TYPE_STYLE: Record<
  ToasterType,
  {
    border: string;
    iconStyle: string;
    icon: keyof typeof icons;
    level: string;
  }
> = {
  success: {
    border: "border-[#14D99B]",
    iconStyle: "text-[#6FE8C0]",
    icon: "CircleCheck",
    level: "복구",
  },
  info: {
    border: "border-[#3D8BFF]",
    iconStyle: "text-[#7EB6FF]",
    icon: "Info",
    level: "안내",
  },
  warning: {
    border: "border-[#FFB020]",
    iconStyle: "text-[#FFC966]",
    icon: "TriangleAlert",
    level: "주의",
  },
  error: {
    border: "border-[#F0484A]",
    iconStyle: "text-[#FF8A8B]",
    icon: "TriangleAlert",
    level: "긴급",
  },
};

function ToastCard({
  title,
  message,
  border,
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
        "pointer-events-auto flex h-16 w-full items-center gap-2 rounded-[10px] border bg-dt-bg/92 px-3 shadow-[inset_0_0_0_1px_#ffffff14]",
        border,
      )}
    >
      <Icon icon={icon} className={cn("size-4 shrink-0", iconStyle)} />
      <div
        className={cn("min-w-0 flex-1 select-none", onClick && "cursor-pointer")}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
      >
        <p className="text-[10px] tracking-[0.12em] text-white/45">{level}</p>
        <p className="truncate text-[13px] font-medium text-white">{title}</p>
        {message ? <p className="truncate text-[12px] text-white/55">{message}</p> : null}
      </div>
      {onTrack ? (
        <button
          type="button"
          onClick={() => {
            onTrack();
            onDismiss();
          }}
          className="shrink-0 rounded-md bg-[#E4572E] px-2 py-0.5 text-[12px] font-medium text-white hover:bg-[#c94b26]"
        >
          추적
        </button>
      ) : null}
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={onDismiss}
        className="grid size-5 shrink-0 place-items-center rounded text-white/45 hover:bg-white/10 hover:text-white"
      >
        <Icon icon="X" className="size-3.5" />
      </button>
    </div>
  );
}

type ToasterOptions = {
  id?: string | number;
  duration?: number;
  message?: string;
  /** 본문 클릭 시 (예: 장비 위치로 카메라 이동) */
  onClick?: () => void;
  /** 지정 시 추적 버튼. 누르면 토스트가 닫힌다 */
  onTrack?: () => void;
};

type ToastEntry = {
  sid: string;
  key?: string | number;
  type: ToasterType;
  title: string;
  message?: string;
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
  }, 160);
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
