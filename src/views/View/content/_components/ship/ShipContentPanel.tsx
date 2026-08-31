import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Icon from "@/components/Icon";
import { SHIP_PLACEMENTS } from "@/constants/model";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { useMemo, useState } from "react";
import ContentDetailLayout, { DetailFields } from "../ContentDetailLayout";
import { CyberHeading } from "../cyber/CyberPanel";

type ShipListItem = {
  key: string;
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
};

export default function ShipContentPanel() {
  const modelShips = useYardStore((s) => s.ships);
  const selectedShipKey = useViewportStore((s) => s.selectedShipKey);
  const selectShip = useViewportStore((s) => s.selectShip);
  const clearShipSelection = useViewportStore((s) => s.clearShipSelection);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const items = useMemo<ShipListItem[]>(() => {
    if (modelShips.length > 0) {
      return modelShips.map((ship, index) => ({
        key: `ship-${index}`,
        title: `Berth ${index + 1}`,
        subtitle: `${ship.craneCount} cranes · ${ship.kind}`,
        details: [
          { label: "kind", value: ship.kind },
          { label: "cranes", value: String(ship.craneCount) },
          {
            label: "position",
            value: ship.position.map((v) => v.toFixed(2)).join(", "),
          },
          {
            label: "rotation",
            value: ship.rotation
              ? ship.rotation.map((v) => v.toFixed(2)).join(", ")
              : "—",
          },
          {
            label: "locator",
            value:
              ship.locatorIndex != null ? String(ship.locatorIndex) : "—",
          },
        ],
      }));
    }

    return SHIP_PLACEMENTS.map((ship) => ({
      key: ship.label,
      title: `Ship ${ship.label}`,
      subtitle: `Locators ${ship.locators.join(", ")}`,
      details: [
        { label: "label", value: ship.label },
        { label: "locators", value: ship.locators.join(", ") },
        {
          label: "position",
          value: ship.position.map((v) => v.toFixed(2)).join(", "),
        },
        { label: "yaw", value: `${ship.yawDeg.toFixed(1)}°` },
        { label: "scale", value: ship.scale.toFixed(3) },
      ],
    }));
  }, [modelShips]);

  const selected = items.find((item) => item.key === selectedKey) ?? null;

  function handleBack() {
    if (selectedKey && selectedShipKey === selectedKey) {
      clearShipSelection();
    }
    setSelectedKey(null);
  }

  if (selected) {
    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.ship}
        title={selected.title}
        subtitle={selected.subtitle}
        onBack={handleBack}
        tracking={selectedShipKey === selected.key}
        onTrack={() => selectShip(selected.key)}
        onClearTrack={clearShipSelection}
      >
        <DetailFields rows={selected.details} />
      </ContentDetailLayout>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <CyberHeading title="Ships" subtitle={`${items.length} vessels`} />

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => setSelectedKey(item.key)}
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
