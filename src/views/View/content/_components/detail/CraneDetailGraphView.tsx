import PieChart from "@/components/PieChart";
import { getCraneDetailGraphMetrics } from "@/domain/craneDetailGraphMock";
import type { DetailGraphSeries } from "@/types/detailGraph";
import DetailLineChart from "./DetailLineChart";

type CraneDetailGraphViewProps = {
  index: number;
  subjectKey: string;
};

function GraphBlock({
  series,
  value,
  valueSuffix,
}: {
  series: DetailGraphSeries;
  value?: string;
  valueSuffix?: string;
}) {
  return (
    <section className="cyber-graph-block shrink-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="cyber-graph-label">{series.label}</h3>
        {value ? (
          <p className="cyber-graph-kpi">
            {value}
            {valueSuffix ? (
              <span className="cyber-graph-kpi-suffix ml-1">{valueSuffix}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <DetailLineChart points={series.points} unit={series.unit} height={84} />
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="cyber-graph-stat">
      <p className="cyber-graph-stat-label">{label}</p>
      <p className="cyber-graph-stat-value">{value}</p>
    </div>
  );
}

export default function CraneDetailGraphView({
  index,
  subjectKey,
}: CraneDetailGraphViewProps) {
  const data = getCraneDetailGraphMetrics(index, subjectKey);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-md overflow-y-auto overscroll-contain pb-sm">
      <GraphBlock
        series={data.movesSeries}
        value={data.movesTotal.toLocaleString()}
        valueSuffix="shift"
      />

      <GraphBlock
        series={data.mphSeries}
        value={String(data.mphCurrent)}
        valueSuffix="m/h"
      />

      <GraphBlock
        series={data.cycleTimeSeries}
        value={String(data.cycleTimeMin)}
        valueSuffix="min"
      />

      <section className="cyber-graph-block shrink-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="cyber-graph-label">Utilization</h3>
          <div className="flex items-center gap-sm">
            <PieChart
              value={data.utilizationPct}
              size={36}
              color="#00E8FF"
              trackColor="rgba(255,255,255,0.1)"
            />
            <p className="cyber-graph-kpi">
              {data.utilizationPct}
              <span className="cyber-graph-kpi-suffix ml-1">%</span>
            </p>
          </div>
        </div>
        <DetailLineChart
          points={data.utilizationSeries.points}
          unit="%"
          height={72}
        />
      </section>

      <div className="grid shrink-0 grid-cols-2 gap-xs">
        <StatTile label="Working" value={`${data.workingHours} h`} />
        <StatTile label="Idle" value={`${data.idleHours} h`} />
      </div>

      <GraphBlock series={data.idleSeries} />

      <section className="cyber-graph-block shrink-0">
        <h3 className="cyber-graph-label mb-1">Job Count</h3>
        <div className="grid grid-cols-3 gap-xs">
          <StatTile label="Done" value={String(data.jobs.completed)} />
          <StatTile label="Active" value={String(data.jobs.inProgress)} />
          <StatTile label="Wait" value={String(data.jobs.waiting)} />
        </div>
      </section>

      <section className="cyber-graph-block shrink-0">
        <h3 className="cyber-graph-label mb-1">Downtime Events</h3>
        <ul className="flex flex-col gap-1">
          {data.downtimeEvents.map((event) => (
            <li
              key={`${event.at}-${event.label}`}
              className="flex items-start justify-between gap-2 border-b border-cyber/8 py-1.5 text-xl last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-white/80">{event.label}</p>
                <p className="text-lg text-white/40">{event.at}</p>
              </div>
              <span className="cyber-graph-kpi shrink-0">{event.durationMin}m</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cyber-graph-block shrink-0">
        <h3 className="cyber-graph-label mb-1">Processed Containers</h3>
        <ul className="max-h-28 overflow-y-auto overscroll-contain">
          {data.processedContainers.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 border-b border-cyber/8 py-1.5 text-xl last:border-b-0"
            >
              <span className="cyber-graph-stat-value truncate">{item.id}</span>
              <span className="shrink-0 text-lg capitalize text-white/45">
                {item.move} · {item.handledAt}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <GraphBlock
        series={data.energySeries}
        value={data.energyKwh.toLocaleString()}
        valueSuffix="kWh"
      />
    </div>
  );
}
