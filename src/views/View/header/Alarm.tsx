import Icon from "@/components/Icon";
import { DropdownMenu } from "@/components/DropdownMenu";
import toastMock from "@/data/toast_mock.json";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import AlarmCard from "./AlarmCard";

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
        className="flex h-128 w-72 min-h-0 flex-col bg-background/80"
      >
        <DropdownMenu.Label className="shrink-0 flex justify-between text-lg text-text-primary">
          <div>알림</div>
          <div className="flex items-center gap-xl">
            <div className="flex items-center gap-xs text-danger">
              <Badge variant="danger" size="sm">
                위험
              </Badge>
              <span className="text-lg font-bold">{dangerCount}</span>
            </div>
            <div className="flex items-center gap-xs text-warning">
              <Badge variant="warning" size="sm">
                경고
              </Badge>
              <span className="text-lg font-bold">{warningCount}</span>
            </div>
          </div>
        </DropdownMenu.Label>
        <DropdownMenu.Separator className="shrink-0" />
        <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto">
          {toastMock.length === 0 ? (
            <DropdownMenu.Item
              disabled
              className="flex h-full w-full flex-col items-center justify-center text-lg text-text-secondary"
            >
              새 알림이 없습니다
            </DropdownMenu.Item>
          ) : (
            toastMock.map((item) => (
              <AlarmCard
                key={`${item.title}-${item.createdAt}`}
                item={item}
              />
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
