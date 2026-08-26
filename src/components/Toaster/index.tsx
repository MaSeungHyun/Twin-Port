/* eslint-disable react-refresh/only-export-components -- Toaster 호스트 + toaster API 공존 */
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import type { icons } from "lucide-react";
import { Toaster as SonnerToaster, toast } from "sonner";

export type ToasterType = "success" | "info" | "warning" | "error";

type ToastCardProps = {
  title: string;
  message?: string;
  toastId: string | number;
  border: string;
  iconStyle: string;
  icon: keyof typeof icons;
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
  border,
  iconStyle,
  icon,
}: ToastCardProps) {
  return (
    <div
      className={cn(
        "flex w-64 items-start gap-md rounded-sm border bg-background/70 px-md py-xs shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md",
        border,
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm">
        <Icon icon={icon} className={cn("size-6", iconStyle)} />
      </div>

      <div className="min-w-0 flex-1 select-none">
        <p className="text-xs font-semibold tracking-wide text-white">
          {title}
        </p>
        {message ? (
          <p className="mt-0.5 text-xs text-neutral-400">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

type ToasterOptions = {
  id?: string | number;
  duration?: number;
  message?: string;
};

function normalizeOptions(
  messageOrOptions?: string | ToasterOptions,
): ToasterOptions {
  if (typeof messageOrOptions === "string") {
    return { message: messageOrOptions };
  }
  return messageOrOptions ?? {};
}

function show(
  type: ToasterType,
  title: string,
  messageOrOptions?: string | ToasterOptions,
) {
  const options = normalizeOptions(messageOrOptions);
  const style = TOASTER_TYPE_STYLE[type];

  return toast.custom(
    (toastId) => (
      <ToastCard
        title={title}
        message={options.message}
        toastId={toastId}
        {...style}
      />
    ),
    {
      id: options.id,
      duration: options.duration ?? 10_000,
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
  dismiss: (id?: string | number) => toast.dismiss(id),
};

/** Viewport 등 트리에 한 번 마운트 */
export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      gap={10}
      offset={8}
      visibleToasts={2}
      className="absolute!"
      style={{ position: "absolute", zIndex: 40 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-auto",
        },
      }}
    />
  );
}
