import type { BlockOccupancy } from "@/domain/occupancy";
import { cn } from "@/utils/style";
import {
  MONITORING_CARD_HEIGHT,
  MONITORING_CARD_WIDTH,
} from "./monitoringCard.constants";

function MonitoringDonut({
  percent,
  color,
  size = 56,
}: {
  percent: number;
  color: string;
  size?: number;
}) {
  const filled = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${filled * 3.6}deg, rgba(255,255,255,0.12) 0)`,
        mask: "radial-gradient(farthest-side, transparent 64%, #000 65%)",
        WebkitMask: "radial-gradient(farthest-side, transparent 64%, #000 65%)",
      }}
    />
  );
}

type MonitoringCardProps = {
  index: number;
  occupancy: BlockOccupancy;
  color: string;
  selected?: boolean;
  onSelect?: () => void;
};

export default function MonitoringCard({
  index,
  occupancy,
  color,
  selected = false,
  onSelect,
}: MonitoringCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex shrink-0 flex-col rounded-md border bg-black px-sm py-sm text-text-primary transition-colors",
        selected ? "border-primary" : "border-white/10 hover:border-white/25",
      )}
      style={{
        width: MONITORING_CARD_WIDTH,
        height: MONITORING_CARD_HEIGHT,
      }}
    >
      <div className="text-sm text-text-secondary tabular-nums h-sm">
        {index}
      </div>
      <div className="flex w-full h-xl items-center justify-center mt-0.5">
        {occupancy.blockCode}
      </div>

      <div
        className="flex w-full items-center mt-md justify-center relative"
        style={{ color }}
      >
        <MonitoringDonut size={79} percent={occupancy.percent} color={color} />
        <div className="absolute w-full flex items-center justify-center text-xl">
          <span className="font-bold text-md">{occupancy.percent}</span>
          <span className="text-sm">%</span>
        </div>
      </div>

      <div className="flex w-full items-center justify-center mt-xl">
        <span className="text-sm text-text-primary">{occupancy.occupied}</span>
        <span className="text-xs text-text-secondary">
          / {occupancy.capacity}
        </span>
      </div>
    </div>
  );
}
