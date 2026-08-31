import PieChart from "@/components/PieChart";
import { getShipDetailGraphData } from "@/domain/shipDetailGraphMock";

type ShipDetailGraphViewProps = {
  index: number;
  subjectKey: string;
};

export default function ShipDetailGraphView({
  index,
  subjectKey,
}: ShipDetailGraphViewProps) {
  const data = getShipDetailGraphData(index, subjectKey);
  const loadPct = Math.round((data.teuLoaded / data.teuCapacity) * 100);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-md overflow-hidden">
      <section className="cyber-graph-block shrink-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="cyber-graph-label">Cargo Load</h3>
          <div className="flex items-center gap-sm">
            <PieChart
              value={loadPct}
              size={36}
              color="#00E8FF"
              trackColor="rgba(255,255,255,0.1)"
            />
            <p className="cyber-graph-kpi">
              {loadPct}
              <span className="cyber-graph-kpi-suffix ml-1">%</span>
            </p>
          </div>
        </div>
        <p className="text-xl tabular-nums text-text-secondary">
          <span className="font-medium text-text-primary">
            {data.teuLoaded.toLocaleString()}
          </span>
          {" / "}
          {data.teuCapacity.toLocaleString()} TEU
        </p>
      </section>

      <section className="cyber-graph-block flex min-h-0 flex-1 flex-col">
        <div className="mb-sm flex shrink-0 items-baseline justify-between gap-2">
          <h3 className="cyber-graph-label">Loaded Containers</h3>
          <p className="text-lg tabular-nums text-white/45">
            {data.loadedContainers.length} logs
          </p>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {data.loadedContainers.map((entry) => (
            <li
              key={`${entry.id}-${entry.loadedAt}`}
              className="flex items-center justify-between gap-2 border-b border-cyber/8 py-1.5 last:border-b-0"
            >
              <span className="truncate text-lg font-medium text-text-primary">
                {entry.id}
              </span>
              <time
                dateTime={entry.loadedAt}
                className="shrink-0 text-lg tabular-nums text-text-secondary"
              >
                {entry.loadedAt}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
