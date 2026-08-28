import Icon from "@/components/Icon";
import { DropdownMenu } from "@/components/DropdownMenu";
import type { ToasterType } from "@/components/Toaster";

const TYPE_ICON_STYLE: Record<ToasterType, string> = {
  success: "stroke-success",
  info: "stroke-primary",
  warning: "stroke-warning",
  error: "stroke-danger",
};

function formatAlertDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export type AlarmCardItem = {
  level: string;
  title: string;
  message?: string;
  createdAt: string;
};

type AlarmCardProps = {
  item: AlarmCardItem;
};

export default function AlarmCard({ item }: AlarmCardProps) {
  return (
    <DropdownMenu.Item className="flex h-14 items-start gap-xl border border-neutral-700 bg-background/50 text-lg items-center">
      <div className="flex h-full items-center justify-center">
        <Icon
          icon="TriangleAlert"
          className={`size-10 ${TYPE_ICON_STYLE[item.level as ToasterType] ?? "stroke-primary"}`}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1 leading-tight justify-between h-full">
        <p className="truncate text-lg font-medium text-white">{item.title}</p>
        <div className="flex items-center justify-between ">
          {item.message ? (
            <p className="mt-0.5 text-lg text-white/45">{item.message}</p>
          ) : null}
          <p className="mt-1 text-lg text-white/30">
            {formatAlertDate(item.createdAt)}
          </p>
        </div>
      </div>
    </DropdownMenu.Item>
  );
}
