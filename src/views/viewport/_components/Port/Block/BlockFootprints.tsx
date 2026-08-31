import { useYardStore } from "@/stores/yard";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import {
  computeBlockOccupancies,
  DANGEROUS_RATIO,
  type BlockOccupancy,
} from "@/domain/occupancy";
import { useMemo } from "react";
import BlockHoverArea from "./BlockHoverArea";
import BlockMarks from "./BlockMarks";

export default function BlockFootprints({
  visible = true,
}: {
  visible?: boolean;
}) {
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const blocks = useYardStore((s) => s.blocks);
  const yardOffset = useYardStore((s) => s.yardOffset);

  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );

  const occupancyByCode = useMemo(
    () =>
      Object.fromEntries(
        occupancies.map((item) => [item.blockCode, item]),
      ) as Record<string, BlockOccupancy>,
    [occupancies],
  );
  const showDangerousBlockCards = useViewportStore(
    (s) => s.showDangerousBlockCards,
  );

  return (
    <group position={[...yardOffset]} visible={visible}>
      <BlockMarks occupancyByCode={occupancyByCode} />
      {blocks.map((block) => {
        const occupancy = occupancyByCode[block.code];
        if (!occupancy) return null;
        return (
          <BlockHoverArea
            key={block.code}
            block={block}
            occupancy={occupancy}
            statusVisible={
              showDangerousBlockCards && occupancy.ratio >= DANGEROUS_RATIO
            }
            hitEnabled={!occupancyLook}
          />
        );
      })}
    </group>
  );
}
