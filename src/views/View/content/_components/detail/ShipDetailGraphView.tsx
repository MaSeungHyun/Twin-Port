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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
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
