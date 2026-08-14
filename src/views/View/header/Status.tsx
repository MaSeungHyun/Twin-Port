import Icon from "@/components/Icon";
import PieChart from "@/components/PieChart";
import {
  computeYardStatus,
  DANGEROUS_RATIO,
  type YardStatus,
  type YardStatusKey,
} from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import type { icons } from "lucide-react";
import { useMemo, type ReactNode } from "react";

export type StatusItemConfig = {
  icon: keyof typeof icons;
  label: string;
  key: YardStatusKey;
  /** 예: "%" → 56.1% */
  unit?: string;
  /** fraction: "현재 / 전체" (of 키 기준) */
  format?: "number" | "fraction";
  /** format="fraction"일 때 분모로 쓸 키 */
  of?: YardStatusKey;
  className?: string;
};

function StatusItem({
  icon,
  label,
  display,
  className,
}: {
  icon: keyof typeof icons;
  label: string;
  display: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1">
      <Icon icon={icon} className={cn("size-6 stroke-primary", className)} />
      <div className="flex flex-col leading-tight select-none">
        <span className="text-xs tracking-semiwide text-neutral-400 uppercase">
          {label}
        </span>
        <span
          className={cn(
            "w-full text-right text-sm font-semibold text-white",
            className,
          )}
        >
          {display}
        </span>
      </div>
    </div>
  );
}

export default function Status() {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const status = useMemo(
    () => computeYardStatus(containers, blocks),
    [blocks, containers],
  );

  return (
    <div className="flex items-center gap-8">
      {STATUS_ITEMS.map((item) =>
        item.key === "occupancy" ? (
          <OccupancyChart key={item.key} status={status} />
        ) : (
          <StatusItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            display={formatValue(status, item)}
            className={item.className}
          />
        ),
      )}
    </div>
  );
}

function occupancyFill(ratio: number): string {
  if (ratio < 0.6) return "#22c55e";
  if (ratio < DANGEROUS_RATIO) return "#eab308";
  return "#ef2444";
}

function formatValue(status: YardStatus, item: StatusItemConfig): ReactNode {
  const value = status[item.key];

  if (item.format === "fraction" && item.of) {
    return (
      <>
        <span>{value.toLocaleString()}</span>
        <span className="ml-1 text-[11px] font-medium text-white/35">
          / {status[item.of].toLocaleString()}
        </span>
      </>
    );
  }

  const text = value.toLocaleString();
  return item.unit ? `${text}${item.unit}` : text;
}

function OccupancyChart({ status }: { status: YardStatus }) {
  // DEV 테스트: 숫자(0~100)로 바꾸면 강제 점유율 적용. null이면 실제 데이터.
  const DEBUG_OCCUPANCY_PERCENT: number | null = null;

  const occupancy = DEBUG_OCCUPANCY_PERCENT ?? status.occupancy;
  const fill = occupancyFill(occupancy / 100);

  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1">
      <PieChart value={occupancy} color={fill} size={32} />
      <div className="flex flex-col leading-tight select-none">
        <span className="text-xs tracking-semiwide text-neutral-400 uppercase">
          OCCUPANCY
        </span>
        <span
          className="w-full text-right text-sm font-semibold"
          style={{ color: fill }}
        >
          {occupancy}%
        </span>
      </div>
    </div>
  );
}

// MOCK
const STATUS_ITEMS: StatusItemConfig[] = [
  { icon: "LayoutTemplate", label: "BLOCKS", key: "blockCount" },
  {
    icon: "Container",
    label: "CONTAINERS",
    key: "totalContainers",
    format: "fraction",
    of: "totalCapacity",
  },
  { icon: "PackageOpen", label: "EMPTY SLOTS", key: "emptySlots" },
  { icon: "ChartPie", label: "OCCUPANCY", key: "occupancy", unit: "%" },
  {
    icon: "TriangleAlert",
    label: "DANGEROUS",
    key: "dangerous",
    className: "stroke-background fill-red-500 text-red-500",
  },
];
