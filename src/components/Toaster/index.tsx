/* eslint-disable react-refresh/only-export-components -- Toaster 호스트 + toaster API 공존 */
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import type { icons } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";
import { createPortal } from "react-dom";
import { useViewportStore } from "@/stores/viewport";

/** 헤더 min-h-20(80px) 아래 — MonitoringOverlay(z-150) 위 */
const TOASTER_Z_INDEX = 160;
const TOASTER_TOP_OFFSET_PX = 90;

export type ToasterType = "success" | "info" | "warning" | "error";

type ToastCardProps = {
  title: string;
  message?: string;
  toastId: string | number;
  border: string;
  iconStyle: string;
  icon: keyof typeof icons;
  onClick?: () => void;
  onTrack?: () => void;
};

/** type별 스타일 — 여기서만 수정 */
export const TOASTER_TYPE_STYLE: Record<
  ToasterType,
  {
    border: string;
    iconStyle: string;
    icon: keyof typeof icons;
  }
> = {
  success: {
    border: "border-success/40",
    iconStyle: "stroke-success",
    icon: "CircleCheck",
  },
  info: {
    border: "border-primary/40",
    iconStyle: "stroke-primary",
    icon: "Info",
  },
  warning: {
    border: "border-warning/40",
    iconStyle: "stroke-warning",
    icon: "TriangleAlert",
  },
  error: {
    border: "border-danger/40",
    iconStyle: "stroke-danger",
    icon: "TriangleAlert",
  },
};

function ToastCard({
  title,
  message,
  toastId,
  border,
  iconStyle,
  icon,
  onClick,
  onTrack,
}: ToastCardProps) {
  return (
    <div
      className={cn(
        "flex w-80 flex-col rounded-sm border bg-background/70 py-xs pl-md pr-xs shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md",
        border,
      )}
    >
      <div className="flex items-stretch gap-md">
      <div className="flex w-8 shrink-0 items-center justify-center">
        <Icon icon={icon} className={cn("size-8", iconStyle)} />
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 select-none py-0.5",
          onClick && "cursor-pointer",
        )}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
      >
        <p className="text-xl font-semibold tracking-wide text-white">
          {title}
        </p>
        {message ? (
          <p className="mt-0.5 text-lg text-neutral-400">{message}</p>
        ) : null}
      </div>

      {!onTrack && (
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={() => toast.dismiss(toastId)}
        className="flex shrink-0 items-center justify-center self-stretch rounded-sm px-xs text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
      >
        <Icon icon="X" className="size-lg stroke-current" />
      </button>
      )}
      </div>
      {onTrack && (
        // [toasttrack] 고장 토스트 — X 대신 하단 추적 / 닫기
        <div className="mt-xs flex w-full gap-xs pr-xs">
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="w-full flex-1 cursor-pointer rounded-sm border border-white/30 px-md py-0.5 text-lg text-white/80 transition-colors hover:bg-white/10"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              onTrack();
              toast.dismiss(toastId);
            }}
            className="w-full flex-1 cursor-pointer rounded-sm border border-[#08B6CE] bg-[#08B6CE] px-md py-0.5 text-lg font-semibold text-black transition-colors hover:bg-[#08B6CE]/80"
          >
            추적
          </button>
        </div>
      )}
    </div>
  );
}

type ToasterOptions = {
  id?: string | number;
  duration?: number;
  message?: string;
  /** 본문 클릭 시 (예: 장비 위치로 카메라 이동) */
  onClick?: () => void;
  /** 지정 시 X 대신 하단 추적/닫기 버튼 (추적 후 토스트 닫힘) */
  onTrack?: () => void;
};

function normalizeOptions(
  messageOrOptions?: string | ToasterOptions,
): ToasterOptions {
  if (typeof messageOrOptions === "string") {
    return { message: messageOrOptions };
  }
  return messageOrOptions ?? {};
}

// [toastid] 같은 id 로 다시 띄우면 기존 토스트는 지우고 새 토스트를 맨 위(최신)로, 타이머도 새로.
// sonner 는 같은 id 면 제자리 갱신만 하므로 내부적으로 매번 고유 id 를 쓰고 사용자 id → 현재 sonner id 를 기억한다.
const liveToastIds = new Map<string | number, string>();
let toastSeq = 0;

function show(
  type: ToasterType,
  title: string,
  messageOrOptions?: string | ToasterOptions,
) {
  // [monitorgate] 관제 시작 전엔 어떤 토스트도 띄우지 않음 (모든 toaster.* 공통 관문)
  if (!useViewportStore.getState().monitoringStarted) return "";
  const options = normalizeOptions(messageOrOptions);
  const style = TOASTER_TYPE_STYLE[type];
  const key = options.id;
  let sonnerId: string | number | undefined;
  if (key != null) {
    const prev = liveToastIds.get(key);
    if (prev != null) toast.dismiss(prev);
    const sid = `${String(key)}#${++toastSeq}`;
    liveToastIds.set(key, sid);
    sonnerId = sid;
  }
  const forget = () => {
    if (key != null && liveToastIds.get(key) === sonnerId) liveToastIds.delete(key);
  };

  return toast.custom(
    (toastId) => (
      <ToastCard
        title={title}
        message={options.message}
        toastId={toastId}
        onClick={options.onClick}
        onTrack={options.onTrack}
        {...style}
      />
    ),
    {
      id: sonnerId,
      onDismiss: forget,
      onAutoClose: forget,
      duration: options.duration ?? Number.POSITIVE_INFINITY,
    },
  );
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
      liveToastIds.clear();
      return toast.dismiss();
    }
    const sid = liveToastIds.get(id);
    liveToastIds.delete(id);
    return toast.dismiss(sid ?? id);
  },
};

/** App 등 트리에 한 번 마운트 — body portal로 overlay 위에 표시 */
export default function Toaster() {
  return createPortal(
    <SonnerToaster
      position="top-right"
      theme="dark"
      gap={10}
      offset={{ top: TOASTER_TOP_OFFSET_PX, right: 8 }}
      visibleToasts={10}
      className="pointer-events-none"
      style={{ position: "fixed", zIndex: TOASTER_Z_INDEX }}
      toastOptions={{
        unstyled: true,
        duration: Number.POSITIVE_INFINITY,
        classNames: {
          toast: "pointer-events-auto w-auto",
        },
      }}
    />,
    document.body,
  );
}
