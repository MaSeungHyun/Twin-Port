import { computeBlockOccupancies, occupancyColor } from "@/domain/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import MonitoringCard from "./MonitoringCard";
import {
  MONITORING_CARD_HEIGHT,
  MONITORING_CARD_WIDTH,
} from "./monitoringCard.constants";

function useScrollEdgeFade(length: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setEdge({
      top: el.scrollTop > 4,
      bottom: maxScroll > 4 && el.scrollTop < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    return () => ro.disconnect();
  }, [update, length]);

  return { scrollRef, edge, onScroll: update };
}

/** Drei Html 카드와 동일한 내용. 3D 좌표가 아니라 DOM 그리드에 0..n 순서 배치 */
export default function MonitoringGrid() {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const selectedBlockCode = useViewportStore((s) => s.selectedBlockCode);
  const selectBlock = useViewportStore((s) => s.selectBlock);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );
  const { scrollRef, edge, onScroll } = useScrollEdgeFade(occupancies.length);

  return (
    <div className="scroll-edge-fade relative h-full w-full">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full w-full overflow-auto p-md"
      >
        <div
          className="mx-auto grid w-full justify-center gap-xs"
          style={{
            gridTemplateColumns: `repeat(auto-fill, ${MONITORING_CARD_WIDTH}px)`,
            gridAutoRows: `${MONITORING_CARD_HEIGHT}px`,
          }}
        >
          {occupancies.map((occupancy, index) => (
            <MonitoringCard
              key={occupancy.blockCode}
              index={index}
              occupancy={occupancy}
              color={occupancyColor(occupancy.ratio)}
              selected={selectedBlockCode === occupancy.blockCode}
              onSelect={() => selectBlock(occupancy.blockCode)}
            />
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="scroll-edge-fade__edge scroll-edge-fade__top"
        data-visible={edge.top}
      />
      <div
        aria-hidden
        className="scroll-edge-fade__edge scroll-edge-fade__bottom"
        data-visible={edge.bottom}
      />
    </div>
  );
}
