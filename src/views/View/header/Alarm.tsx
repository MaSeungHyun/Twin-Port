import Icon from "@/components/Icon";
import { DropdownMenu } from "@/components/DropdownMenu";
import toastMock from "@/data/toast_mock.json";
import type { ToasterType } from "@/components/Toaster";
import Button from "@/components/Button";
import Badge from "@/components/Badge";

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

export default function Alarm() {
  const dangerCount = toastMock.filter((item) => item.level === "error").length;
  const warningCount = toastMock.filter(
    (item) => item.level === "warning",
  ).length;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Icon icon="Bell" className="size-6 stroke-primary" />
          {toastMock.length > 0 ? (
            <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-danger" />
          ) : null}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        sideOffset={10}
        alignOffset={-10}
        align="end"
        className="flex h-120 w-72 min-h-0 flex-col bg-background/80"
      >
        <DropdownMenu.Label className="shrink-0 text-text-primary flex justify-between">
          <div>알림</div>
          <div className="flex items-center gap-xl">
            <div className="flex items-center gap-xs text-danger">
              <Badge variant="danger" size="sm">
                위험
              </Badge>
              <span className="text-md font-bold">{dangerCount}</span>
            </div>
            <div className="flex items-center gap-xs text-warning">
              <Badge variant="warning" size="sm">
                경고
              </Badge>
              <span className="text-md font-bold">{warningCount}</span>
            </div>
          </div>
        </DropdownMenu.Label>
        <DropdownMenu.Separator className="shrink-0" />
        <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto">
          {toastMock.length === 0 ? (
            <DropdownMenu.Item
              disabled
              className="flex flex-col w-full h-full items-center justify-center text-text-secondary"
            >
              새 알림이 없습니다
            </DropdownMenu.Item>
          ) : (
            toastMock.map((item) => (
              <DropdownMenu.Item
                key={`${item.title}-${item.createdAt}`}
                className="flex items-start h-12 bg-background/50 border border-neutral-700 gap-xl"
              >
                <div className="flex items-center justify-center h-full">
                  <Icon
                    icon="TriangleAlert"
                    className={`size-6 ${TYPE_ICON_STYLE[item.level as ToasterType] ?? "stroke-primary"}`}
                  />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-white">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between">
                    {item.message ? (
                      <p className="mt-0.5 text-xs text-white/45">
                        {item.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-white/30">
                      {formatAlertDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              </DropdownMenu.Item>
            ))
          )}
        </div>
        {/* <DropdownMenu.Separator /> */}
        {/* <DropdownMenu.Item>전체 읽음</DropdownMenu.Item>
        <DropdownMenu.Item variant="danger">모두 지우기</DropdownMenu.Item> */}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
