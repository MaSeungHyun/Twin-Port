import { Accordion } from "@/components/Accordion";
import { getBlockSlotGrid } from "@/constants/block";
import { computeBlockOccupancies, occupancyColor } from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { useMemo, type ReactNode } from "react";

export type BlockSortBy = "name" | "occupancy";
export type BlockSortOrder = "desc" | "asc";

export default function BlockAccordion({
  sortBy = "occupancy",
  sortOrder = "desc",
}: {
  sortBy?: BlockSortBy;
  sortOrder?: BlockSortOrder;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );

  const byCode = useMemo(
    () => Object.fromEntries(occupancies.map((o) => [o.blockCode, o])),
    [occupancies],
  );

  const sortedBlocks = useMemo(() => {
    const sorted = [...blocks];
    const dir = sortOrder === "desc" ? -1 : 1;

    sorted.sort((a, b) => {
      if (sortBy === "name") {
        return a.code.localeCompare(b.code) * dir;
      }

      const ratioA = byCode[a.code]?.ratio ?? 0;
      const ratioB = byCode[b.code]?.ratio ?? 0;
      if (ratioA !== ratioB) {
        return (ratioA - ratioB) * dir;
      }
      return a.code.localeCompare(b.code);
    });

    return sorted;
  }, [blocks, byCode, sortBy, sortOrder]);

  return (
    <Accordion type="multiple" className="w-full">
      {sortedBlocks.map((block) => {
        const occupancy = byCode[block.code];
        if (!occupancy) return null;
        const grid = getBlockSlotGrid(block);
        const color = occupancyColor(occupancy.ratio);
        const empty = occupancy.capacity - occupancy.occupied;

        return (
          <Accordion.Item key={block.code} value={block.code}>
            <Accordion.Header className="flex">
              <Accordion.Trigger className="px-xl py-sm text-lg">
                <span className="flex min-w-0 flex-1 items-center gap-xs">
                  <span
                    className="size-xs shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate font-semibold tracking-wide">
                    {block.code}
                  </span>
                </span>
                <span className="mr-1 tabular-nums" style={{ color }}>
                  {occupancy.percent}%
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-xl">
              <div className="flex items-center gap-md rounded-md border border-white/8 bg-black/25 px-sm py-xs">
                {/* <PieChart value={occupancy.percent} color={color} size={44} /> */}
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-lg">
                  <Row
                    label="적재"
                    value={
                      <>
                        {occupancy.occupied}
                        <span className="text-md font-medium text-text-secondary">
                          {" / "}
                          {occupancy.capacity}
                        </span>
                      </>
                    }
                  />
                  <Row label="공슬롯" value={String(empty)} />
                  <Row
                    label="규격"
                    value={`${grid.bays}×${grid.rows}×${grid.tiers}`}
                  />
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-xs">
      <span className="text-white/45 flex-1">{label}</span>
      <span className="font-medium text-white tabular-nums flex-2">
        {value}
      </span>
    </div>
  );
}
