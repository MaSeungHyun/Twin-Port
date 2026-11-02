import InfoTip from "@/components/InfoTip";
import PieChart from "@/components/PieChart";
import { INFO_TIPS } from "@/constants/infoTips";
import { usePortSim } from "@/hooks/usePortSim";
import { getCraneDetailGraphMetrics } from "@/domain/craneDetailGraphMock";
import type { DetailGraphSeries } from "@/types/detailGraph";
import DetailLineChart from "./DetailLineChart";

type CraneDetailGraphViewProps = {
  index: number;
  subjectKey: string;
  kind?: "crane" | "overheadCrane";
};

function GraphLabel({ text, info, className }: { text: string; info: string; className?: string }) {
  return (
    <h3 className={`cyber-graph-label flex items-center gap-xs ${className ?? ""}`}>
      {text}
      <InfoTip text={info} />
    </h3>
  );
}

function GraphBlock({
  series,
  value,
  valueSuffix,
  info,
}: {
  series: DetailGraphSeries;
  info: string;
  value?: string;
  valueSuffix?: string;
}) {
  return (
    <section className="cyber-graph-block shrink-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <GraphLabel text={series.label} info={info} />
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
  kind = "crane",
}: CraneDetailGraphViewProps) {
  usePortSim();
  const data = getCraneDetailGraphMetrics(index, subjectKey, kind);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-md scrollbar-themed overflow-y-auto overscroll-contain pb-sm">
      <GraphBlock
        series={data.movesSeries} info={INFO_TIPS.throughput}
        value={data.movesTotal.toLocaleString()}
        valueSuffix="shift"
      />

      <GraphBlock
        series={data.mphSeries} info={INFO_TIPS.mph}
        value={String(data.mphCurrent)}
        valueSuffix="m/h"
      />

      <GraphBlock
        series={data.cycleTimeSeries} info={INFO_TIPS.cycleTime}
        value={String(data.cycleTimeMin)}
        valueSuffix="min"
      />

      <section className="cyber-graph-block shrink-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <GraphLabel text="Utilization" info={INFO_TIPS.utilization} />
          <div className="flex items-center gap-sm">
            <PieChart
              value={data.utilizationPct}
              size={36}
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

      <GraphBlock series={data.idleSeries} info={INFO_TIPS.idleTime} />

      <section className="cyber-graph-block shrink-0">
        <GraphLabel text="Job Count" info={INFO_TIPS.jobCount} className="mb-1" />
        <div className="grid grid-cols-3 gap-xs">
          <StatTile label="Done" value={String(data.jobs.completed)} />
          <StatTile label="Active" value={String(data.jobs.inProgress)} />
          <StatTile label="Wait" value={String(data.jobs.waiting)} />
        </div>
      </section>

      <section className="cyber-graph-block shrink-0">
        <GraphLabel text="Downtime Events" info={INFO_TIPS.downtime} className="mb-1" />
        {data.downtimeEvents.length === 0 ? (
          <p className="py-1.5 text-lg text-white/40">정지 이력이 없습니다</p>
        ) : (
          <ul className="scrollbar-themed flex max-h-40 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
            {data.downtimeEvents.map((event) => (
              <li
                key={`${event.startMs}-${event.label}`}
                className="flex items-start justify-between gap-2 border-b border-cyber/8 py-1.5 text-xl last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-white/80">{event.label}</p>
                  <p className="text-lg text-white/40">
                    {event.at} ~{" "}
                    {event.endAt ?? <span className="text-danger">진행 중</span>}
                  </p>
                </div>
                <span className={`cyber-graph-kpi shrink-0 ${event.endAt == null ? "text-danger" : ""}`}>
                  {event.durationMin}m
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cyber-graph-block shrink-0">
        <GraphLabel text="Processed Containers" info={INFO_TIPS.processed} className="mb-1" />
        <ul className="scrollbar-themed max-h-28 overflow-y-auto overscroll-contain pr-1">
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
        series={data.energySeries} info={INFO_TIPS.energy}
        value={data.energyKwh.toLocaleString()}
        valueSuffix="kWh"
      />
    </div>
  );
}
