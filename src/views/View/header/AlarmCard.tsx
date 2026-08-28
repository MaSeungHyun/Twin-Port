import Icon from "@/components/Icon";
import { DropdownMenu } from "@/components/DropdownMenu";
import type { ToasterType } from "@/components/Toaster";
import { cn } from "@/utils/style";

const TYPE_ICON_STYLE: Record<ToasterType, string> = {
  success: "stroke-success",
  info: "stroke-primary",
  warning: "stroke-warning",
  error: "stroke-danger",
};

const TYPE_ITEM_STYLE: Record<ToasterType, string> = {
  success: "border-success/40 bg-success/15",
  info: "border-primary/40 bg-primary/15",
  warning: "border-warning/40 bg-warning/15",
  error: "border-danger/40 bg-danger/15",
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
  const level = item.level as ToasterType;
  const itemStyle = TYPE_ITEM_STYLE[level] ?? TYPE_ITEM_STYLE.info;

  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-14 items-center gap-xl border text-lg",
        itemStyle,
      )}
    >
      <div className="flex h-full items-center justify-center">
        <Icon
          icon="TriangleAlert"
          className={`size-10 ${TYPE_ICON_STYLE[level] ?? TYPE_ICON_STYLE.info}`}
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
