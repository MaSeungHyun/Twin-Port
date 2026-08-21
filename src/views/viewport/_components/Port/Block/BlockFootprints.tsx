import { useYardStore } from "@/stores/yard";
import { useViewportStore } from "@/stores/viewport";
import {
  computeBlockOccupancies,
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
  const occupancyLook = useViewportStore((s) => s.occupancyLook);
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
            statusVisible={false}
            hitEnabled={!occupancyLook}
          />
        );
      })}
    </group>
  );
}
