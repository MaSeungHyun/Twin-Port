import { cn } from "@/utils/style";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DetailGraphPoint } from "@/types/detailGraph";

const CYBER = "#00E8FF";
const GRID = "rgba(0, 232, 255, 0.08)";

type ChartRow = {
  x: number;
  label: string;
  value: number;
};

type DetailLineChartProps = {
  points: DetailGraphPoint[];
  unit?: string;
  height?: number;
  className?: string;
  color?: string;
};

/** 포인트 사이를 보간해 곡선이 각지지 않도록 촘촘한 데이터 생성 */
function densifyPoints(
  points: DetailGraphPoint[],
  subdivisions = 6,
): ChartRow[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ x: 0, label: points[0]!.t, value: points[0]!.value }];
  }

  const rows: ChartRow[] = [{ x: 0, label: points[0]!.t, value: points[0]!.value }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    for (let step = 1; step <= subdivisions; step++) {
      const ratio = step / subdivisions;
      rows.push({
        x: i - 1 + ratio,
        label: step === subdivisions ? curr.t : "",
        value: prev.value + (curr.value - prev.value) * ratio,
      });
    }
  }

  return rows;
}

export default function DetailLineChart({
  points,
  unit,
  height = 88,
  className,
  color = CYBER,
}: DetailLineChartProps) {
  const data = useMemo(() => densifyPoints(points), [points]);
  const axisTicks = useMemo(
    () => points.map((_, index) => index),
    [points],
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, Math.max(points.length - 1, 0)]}
            ticks={axisTicks}
            tickFormatter={(x) => points[Math.round(x)]?.t ?? ""}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(6, 13, 19, 0.92)",
              border: "1px solid rgba(0, 232, 255, 0.25)",
              borderRadius: 4,
              fontSize: 11,
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as ChartRow | undefined;
              if (row?.label) return row.label;
              const nearest = Math.round(row?.x ?? 0);
              return points[nearest]?.t ?? "";
            }}
            formatter={(value) => [
              `${typeof value === "number" ? Math.round(value * 10) / 10 : value}${unit ? ` ${unit}` : ""}`,
              "",
            ]}
          />
          <Line
            type="natural"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
