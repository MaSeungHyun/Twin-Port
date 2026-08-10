import { Accordion } from "@/components/Accordion";
import PieChart from "@/components/PieChart";
import { BLOCKS, SLOT_MAX_SIZE } from "@/constants/block";
import { computeBlockOccupancies, occupancyColor } from "@/domain/occupancy";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useMemo } from "react";

export type BlockSortBy = "name" | "occupancy";
export type BlockSortOrder = "desc" | "asc";

export default function BlockAccordion({
  sortBy = "occupancy",
  sortOrder = "desc",
}: {
  sortBy?: BlockSortBy;
  sortOrder?: BlockSortOrder;
}) {
  const occupancies = useMemo(
    () => computeBlockOccupancies(mockContainers as Container[]),
    [],
  );

  const byCode = useMemo(
    () => Object.fromEntries(occupancies.map((o) => [o.blockCode, o])),
    [occupancies],
  );

  const sortedBlocks = useMemo(() => {
    const blocks = [...BLOCKS];
    const dir = sortOrder === "desc" ? -1 : 1;

    blocks.sort((a, b) => {
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

    return blocks;
  }, [byCode, sortBy, sortOrder]);

  return (
    <Accordion type="multiple" className="w-full">
      {sortedBlocks.map((block) => {
        const occupancy = byCode[block.code];
        if (!occupancy) return null;
        const color = occupancyColor(occupancy.ratio);
        const empty = occupancy.capacity - occupancy.occupied;

        return (
          <Accordion.Item key={block.code} value={block.code}>
            <Accordion.Trigger className="px-2 py-2.5 text-xs">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
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
            <Accordion.Content className="px-2">
              <div className="flex items-center gap-3 rounded-md border border-white/8 bg-black/25 px-2.5 py-2">
                <PieChart value={occupancy.percent} color={color} size={44} />
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                  <Row
                    label="적재"
                    value={`${occupancy.occupied} / ${occupancy.capacity}`}
                  />
                  <Row label="공슬롯" value={String(empty)} />
                  <Row
                    label="규격"
                    value={`${SLOT_MAX_SIZE.bays}×${SLOT_MAX_SIZE.rows}×${SLOT_MAX_SIZE.tiers}`}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/45">{label}</span>
      <span className="font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}
