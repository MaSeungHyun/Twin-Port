import InfoTip from "@/components/InfoTip";
import PieChart from "@/components/PieChart";
import { INFO_TIPS } from "@/constants/infoTips";
import { usePortSim } from "@/hooks/usePortSim";
import { getShipDetailGraphData } from "@/domain/shipDetailGraphMock";

type ShipDetailGraphViewProps = {
  index: number;
  subjectKey: string;
};

export default function ShipDetailGraphView({
  index,
  subjectKey,
}: ShipDetailGraphViewProps) {
  usePortSim();
  const data = getShipDetailGraphData(index, subjectKey);
  const loadPct = data.teuCapacity > 0 ? Math.round((data.teuLoaded / data.teuCapacity) * 100) : 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-md overflow-hidden">
      <section className="cyber-graph-block shrink-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="cyber-graph-label flex items-center gap-xs">
            Cargo Load
            <InfoTip text={INFO_TIPS.cargoLoad} />
          </h3>
          <div className="flex items-center gap-sm">
            <PieChart
              value={loadPct}
              size={36}
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
          <h3 className="cyber-graph-label flex items-center gap-xs">
            Handled Containers
            <InfoTip text={INFO_TIPS.shipLogs} />
          </h3>
          <p className="text-lg tabular-nums text-white/45">
            {data.loadedContainers.length} logs
          </p>
        </div>

        <ul className="min-h-0 flex-1 scrollbar-themed overflow-y-auto overscroll-contain">
          {data.loadedContainers.map((entry) => (
            <li
              key={`${entry.id}-${entry.loadedAt}`}
              className="flex items-center justify-between gap-2 border-b border-cyber/8 py-1.5 last:border-b-0"
            >
              <span className="truncate text-lg font-medium text-text-primary">
                {entry.id}
              </span>
              {entry.move ? (
                <span className="shrink-0 text-lg capitalize text-white/45">
                  {entry.move}
                </span>
              ) : null}
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
