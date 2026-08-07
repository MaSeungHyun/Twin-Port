import { BLOCKS } from "@/constants/block";
import { CONTAINER_YARD_OFFSET } from "@/domain/container";
import {
  computeBlockOccupancies,
  type BlockOccupancy,
} from "@/domain/occupancy";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useViewportStore } from "@/stores/viewport";
import { useMemo } from "react";
import BlockHoverArea from "./BlockHoverArea";
import BlockMarks from "./BlockMarks";

export default function BlockFootprints({
  visible = true,
}: {
  visible?: boolean;
}) {
  const monitorMode = useViewportStore((s) => s.monitorMode);

  const occupancies = useMemo(
    () => computeBlockOccupancies(mockContainers as Container[]),
    [],
  );

  const occupancyByCode = useMemo(
    () =>
      Object.fromEntries(
        occupancies.map((item) => [item.blockCode, item]),
      ) as Record<string, BlockOccupancy>,
    [occupancies],
  );

  return (
    <group position={CONTAINER_YARD_OFFSET} visible={visible}>
      <BlockMarks occupancyByCode={occupancyByCode} />
      {BLOCKS.map((block) => {
        const occupancy = occupancyByCode[block.code];
        if (!occupancy) return null;
        return (
          <BlockHoverArea
            key={block.code}
            block={block}
            occupancy={occupancy}
            statusVisible={monitorMode}
          />
        );
      })}
    </group>
  );
}
