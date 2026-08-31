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
  success: "border-success/40",
  info: "border-primary/40",
  warning: "border-warning/40",
  error: "border-danger/40",
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
        "flex h-18 items-center gap-xl border bg-background py-2 text-lg [&_svg]:size-[2.625rem]!",
        itemStyle,
      )}
    >
      <div className="flex h-full items-center justify-center">
        <Icon
          icon="TriangleAlert"
          className={TYPE_ICON_STYLE[level] ?? TYPE_ICON_STYLE.info}
        />
      </div>
      <div className="flex h-full min-w-0 flex-1 flex-col justify-between leading-tight">
        <p className="truncate text-lg font-medium text-white">{item.title}</p>
        <div className="flex items-center justify-between">
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
