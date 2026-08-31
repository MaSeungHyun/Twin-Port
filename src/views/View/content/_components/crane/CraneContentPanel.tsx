import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Icon from "@/components/Icon";
import { getCraneListSource, resolveCraneIndex } from "@/domain/cameraFocus";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { useMemo, useState } from "react";
import ContentDetailLayout, { DetailFields } from "../ContentDetailLayout";
import { CyberHeading } from "../cyber/CyberPanel";

type CraneListItem = {
  key: string;
  index: number;
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
};

export default function CraneContentPanel() {
  const quayCranes = useYardStore((s) => s.quayCranes);
  const selectedCraneIndex = useViewportStore((s) => s.selectedCraneIndex);
  const selectCrane = useViewportStore((s) => s.selectCrane);
  const clearCraneSelection = useViewportStore((s) => s.clearCraneSelection);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const items = useMemo<CraneListItem[]>(() => {
    const { placements, fromModel } = getCraneListSource();
    return placements.map((crane, index) => {
      const label = `Crane ${String(index + 1).padStart(2, "0")}`;
      const position = crane.position.map((v) => v.toFixed(1)).join(", ");

      return {
        key: `crane-${index}`,
        index,
        title: label,
        subtitle: `${crane.kind} · (${position})`,
        details: [
          { label: "index", value: String(index + 1) },
          { label: "kind", value: crane.kind },
          { label: "mesh", value: crane.mesh },
          { label: "position", value: position },
          { label: "height", value: crane.height > 0 ? crane.height.toFixed(2) : "—" },
          { label: "source", value: fromModel ? "BUSAN.glb" : "fallback" },
        ],
      };
    });
  }, [quayCranes]);

  const selected = items.find((item) => item.key === selectedKey) ?? null;

  function handleBack() {
    if (
      selectedKey != null &&
      resolveCraneIndex(selectedKey) === selectedCraneIndex
    ) {
      clearCraneSelection();
    }
    setSelectedKey(null);
  }

  if (selected) {
    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.crane}
        title={selected.title}
        titleClassName="cyber-detail-title"
        onBack={handleBack}
        tracking={selectedCraneIndex === selected.index}
        onTrack={() => selectCrane(selected.index)}
        onClearTrack={clearCraneSelection}
      >
        <DetailFields rows={selected.details} />
      </ContentDetailLayout>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <CyberHeading
        title="Cranes"
        subtitle={`${items.length} quay cranes`}
      />

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => setSelectedKey(item.key)}
              className={cn(
                "cyber-list-row flex w-full items-center gap-sm px-xl py-sm text-left",
                selectedCraneIndex === item.index && "bg-cyber/8",
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
              {selectedCraneIndex === item.index ? (
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
