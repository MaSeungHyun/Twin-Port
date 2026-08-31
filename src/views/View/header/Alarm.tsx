import Icon from "@/components/Icon";
import { DropdownMenu } from "@/components/DropdownMenu";
import toastMock from "@/data/toast_mock.json";
import Button from "@/components/Button";
import AlarmCard from "./AlarmCard";
import LevelFilter from "@/components/LevelFilter";
import {
  ALARM_LEVELS,
  alarmLevelFromToast,
  DEFAULT_ALARM_LEVEL_FILTER,
  type AlarmLevelFilterState,
} from "@/components/LevelFilter/constants";
import CyberPanel, { CyberHeading } from "@/views/View/content/_components/cyber/CyberPanel";
import { useCallback, useMemo, useState } from "react";

function matchesAlarmFilter(
  level: string,
  filter: AlarmLevelFilterState,
): boolean {
  const alarmLevel = alarmLevelFromToast(level);
  if (alarmLevel === "danger") return filter.danger;
  if (alarmLevel === "warning") return filter.warning;
  return true;
}

export default function Alarm() {
  const [levelFilter, setLevelFilter] = useState<AlarmLevelFilterState>(
    DEFAULT_ALARM_LEVEL_FILTER,
  );

  const levelCounts = useMemo(() => {
    const counts: Record<(typeof ALARM_LEVELS)[number], number> = {
      danger: 0,
      warning: 0,
    };
    for (const item of toastMock) {
      const level = alarmLevelFromToast(item.level);
      if (level === "danger" || level === "warning") {
        counts[level] += 1;
      }
    }
    return counts;
  }, []);

  const filteredItems = useMemo(
    () =>
      toastMock.filter((item) => matchesAlarmFilter(item.level, levelFilter)),
    [levelFilter],
  );

  const toggleLevelFilter = useCallback(
    (level: (typeof ALARM_LEVELS)[number]) => {
      setLevelFilter((prev) => ({ ...prev, [level]: !prev[level] }));
    },
    [],
  );

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Icon icon="Bell" className="stroke-primary" />
          {toastMock.length > 0 ? (
            <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-danger" />
          ) : null}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        sideOffset={30}
        alignOffset={-10}
        align="end"
        className="h-120 w-100 min-h-0 border-0 bg-transparent p-0 shadow-none"
      >
        <CyberPanel className="flex h-full min-h-0 flex-col backdrop-blur-md">
          <CyberHeading
            title="알림"
            trailing={
              <LevelFilter
                ariaLabel="알림 종류 필터"
                levels={ALARM_LEVELS}
                counts={levelCounts}
                value={levelFilter}
                onChange={toggleLevelFilter}
                size="sm"
                preventPointerDown
              />
            }
          />

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-xl py-sm">
            {toastMock.length === 0 ? (
              <p className="flex flex-1 items-center justify-center py-xl text-lg text-text-secondary">
                새 알림이 없습니다
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="flex flex-1 items-center justify-center py-xl text-lg text-text-secondary">
                표시할 알림이 없습니다
              </p>
            ) : (
              filteredItems.map((item) => (
                <AlarmCard key={`${item.title}-${item.createdAt}`} item={item} />
              ))
            )}
          </div>
        </CyberPanel>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
