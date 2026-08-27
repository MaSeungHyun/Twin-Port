import {
  occupancyColor,
  occupancyLevel,
  type BlockOccupancy,
} from "@/domain/occupancy";
import type { MonitoringLevelFilterState } from "@/views/viewport/_components/monitoringLevelFilter.constants";
import { useViewportStore } from "@/stores/viewport";
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

type MonitoringGridProps = {
  occupancies: BlockOccupancy[];
  levelFilter: MonitoringLevelFilterState;
};

/** Drei Html 카드와 동일한 내용. 3D 좌표가 아니라 DOM 그리드에 0..n 순서 배치 */
export default function MonitoringGrid({
  occupancies,
  levelFilter,
}: MonitoringGridProps) {
  const selectedBlockCode = useViewportStore((s) => s.selectedBlockCode);
  const selectBlock = useViewportStore((s) => s.selectBlock);

  const filteredOccupancies = useMemo(
    () =>
      occupancies.filter(
        (occupancy) => levelFilter[occupancyLevel(occupancy.ratio)],
      ),
    [levelFilter, occupancies],
  );

  const { scrollRef, edge, onScroll } = useScrollEdgeFade(
    filteredOccupancies.length,
  );

  return (
    <div className="scroll-edge-fade relative min-h-0 flex-1 mt-2">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full w-full overflow-auto p-md"
      >
        {filteredOccupancies.length === 0 ? (
          <p className="py-xl text-center text-sm text-text-secondary">
            표시할 블록이 없습니다
          </p>
        ) : (
          <div
            className="mx-auto grid w-full justify-center gap-md"
            style={{
              gridTemplateColumns: `repeat(auto-fill, ${MONITORING_CARD_WIDTH}px)`,
              gridAutoRows: `${MONITORING_CARD_HEIGHT}px`,
            }}
          >
            {filteredOccupancies.map((occupancy, index) => (
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
        )}
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
