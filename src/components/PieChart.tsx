import { cn } from "@/utils/style";
import { useMemo } from "react";
import { Cell, Pie, PieChart as RechartsPieChart } from "recharts";

type PieChartProps = {
  /** 0~100 채움 비율 (%) */
  value: number;
  size?: number;
  /** 채워지는 색 */
  color?: string;
  /** 남은 구간 색 */
  trackColor?: string;
  /** 도넛 구멍 비율 (0~1). 0이면 일반 파이 */
  innerRatio?: number;
  className?: string;
  animated?: boolean;
};

export default function PieChart({
  value,
  size = 36,
  color = "#377cbd",
  trackColor = "rgba(255,255,255,0.12)",
  innerRatio = 0.65,
  className,
  animated = false,
}: PieChartProps) {
  const chartData = useMemo(() => {
    const filled = Math.min(100, Math.max(0, value));
    return [
      { name: "filled", value: filled, color },
      { name: "rest", value: 100 - filled, color: trackColor },
    ].filter((item) => item.value > 0);
  }, [color, trackColor, value]);

  const outerRadius = size / 2 - 1;
  const innerRadius = outerRadius * innerRatio;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <RechartsPieChart width={size} height={size}>
        <Pie
          data={chartData}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={animated}
        >
          {chartData.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Pie>
      </RechartsPieChart>
    </div>
  );
}
