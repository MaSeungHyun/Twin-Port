import { usePortSim } from "@/hooks/usePortSim";
import { INFO_TIPS } from "@/constants/infoTips";
import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Icon from "@/components/Icon";
import { SHIP_PLACEMENTS } from "@/constants/model";
import {
  getShipTwinProfile,
  resolveShipTwinIndex,
  shipTwinDetailRows,
  shipStatusLabel,
} from "@/domain/portTwinMock";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { useMemo } from "react";
import ContentDetailLayout, { DetailFields } from "../ContentDetailLayout";
import Button from "@/components/Button";
import { CyberHeading } from "../cyber/CyberPanel";

type ShipListItem = {
  key: string;
  index: number;
  title: string;
  subtitle: string;
};

export default function ShipContentPanel() {
  const sim = usePortSim();
  const modelShips = useYardStore((s) => s.ships);
  const selectedShipKey = useViewportStore((s) => s.selectedShipKey);
  const selectShip = useViewportStore((s) => s.selectShip);
  const clearShipSelection = useViewportStore((s) => s.clearShipSelection);
  const clearShipDetailFocus = useViewportStore((s) => s.clearShipDetailFocus);
  const detailShipKey = useContentViewStore((s) => s.detailShipKey);
  const openShipDetail = useContentViewStore((s) => s.openShipDetail);
  const clearContentDetail = useContentViewStore((s) => s.clearContentDetail);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const toggleDetailGraph = useContentViewStore((s) => s.toggleDetailGraph);
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);

  const items = useMemo<ShipListItem[]>(() => {
    if (modelShips.length > 0) {
      return modelShips.map((_ship, index) => {
        const twin = getShipTwinProfile(index);
        return {
          key: `ship-${index}`,
          index,
          title: twin.vesselName,
          subtitle: `${twin.berth} · ${twin.flag} · ${twin.loa}`,
        };
      });
    }

    return SHIP_PLACEMENTS.map((ship, index) => {
      const twin = getShipTwinProfile(index);
      return {
        key: ship.label,
        index,
        title: twin.vesselName,
        subtitle: `${twin.flag} · ${twin.loa}`,
      };
    });
  }, [modelShips, sim]);

  const selected = items.find((item) => item.key === detailShipKey) ?? null;

  function handleBack() {
    clearShipDetailFocus();
    clearContentDetail();
    closeDetailGraph();
  }

  function openDetail(item: ShipListItem) {
    openShipDetail(item.key);
  }

  if (selected) {
    const twin = getShipTwinProfile(
      selected.index ?? resolveShipTwinIndex(selected.key),
    );

    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.ship}
        title={twin.vesselName}
        subtitle={`${twin.flag} · ${twin.loa} · ${twin.teu.toLocaleString()} TEU`}
        compactHero
        onBack={handleBack}
        tracking={selectedShipKey === selected.key}
        onTrack={() => selectShip(selected.key)}
        onClearTrack={clearShipSelection}
        onDetailClick={() =>
          toggleDetailGraph({
            kind: "ship",
            key: selected.key,
            index: selected.index,
          })
        }
        detailGraphActive={
          detailGraphOpen &&
          detailGraphSubject?.kind === "ship" &&
          detailGraphSubject.key === selected.key
        }
      >
        <DetailFields rows={shipTwinDetailRows(twin)} />
        <Button
          onClick={() => useContentViewStore.getState().setActiveView("schedule")}
          className="mx-md my-sm border border-cyber/30 py-sm text-primary"
        >
          입출항 스케줄 보기
        </Button>
      </ContentDetailLayout>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <CyberHeading
        title="선박"
        subtitle={`${items.length} vessels`}
        info={INFO_TIPS.shipList}
      />

      <ul className="min-h-0 flex-1 scrollbar-themed overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => openDetail(item)}
              className={cn(
                "cyber-list-row flex w-full items-center gap-sm px-xl py-sm text-left",
                selectedShipKey === item.key && "bg-cyber/8",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-medium text-text-primary">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-lg text-text-secondary">
                  {item.subtitle}
                </p>
                <p className="mt-xs text-base text-primary">
                  {shipStatusLabel(getShipTwinProfile(item.index).status)}
                </p>
              </div>
              {selectedShipKey === item.key ? (
                <Icon icon="Focus" className="size-lg shrink-0 stroke-cyber" />
              ) : (
                <Icon
                  icon="ChevronRight"
                  className="size-lg shrink-0 stroke-cyber/50"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
