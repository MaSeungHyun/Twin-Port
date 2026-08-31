import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Icon from "@/components/Icon";
import { getCraneListSource, resolveCraneIndex } from "@/domain/cameraFocus";
import {
  craneTwinDetailRows,
  craneOperationalTone,
  craneStatusLabel,
  getCraneTwinProfile,
} from "@/domain/portTwinMock";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { useMemo, useState } from "react";
import ContentDetailLayout, { DetailFields } from "../ContentDetailLayout";
import { CraneStatusDot } from "../detail/OperationalStatusIndicator";
import { CyberHeading } from "../cyber/CyberPanel";

type CraneListItem = {
  key: string;
  index: number;
  glbName: string;
  title: string;
  subtitle: string;
};

export default function CraneContentPanel() {
  const quayCranes = useYardStore((s) => s.quayCranes);
  const selectedCraneIndex = useViewportStore((s) => s.selectedCraneIndex);
  const selectCrane = useViewportStore((s) => s.selectCrane);
  const clearCraneSelection = useViewportStore((s) => s.clearCraneSelection);
  const focusCraneDetail = useViewportStore((s) => s.focusCraneDetail);
  const clearCraneDetailFocus = useViewportStore((s) => s.clearCraneDetailFocus);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const toggleDetailGraph = useContentViewStore((s) => s.toggleDetailGraph);
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);

  const items = useMemo<CraneListItem[]>(() => {
    const { placements } = getCraneListSource();
    return placements.map((crane) => {
      const twin = getCraneTwinProfile(crane.glbIndex);
      return {
        key: `crane-${crane.glbIndex}`,
        index: crane.glbIndex,
        glbName: crane.mesh,
        title: `Crane ${String(crane.glbIndex).padStart(2, "0")}`,
        subtitle: `${twin.craneId} · ${crane.mesh} · ${twin.containersMoved.toLocaleString()} moves`,
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
    clearCraneDetailFocus();
    closeDetailGraph();
    setSelectedKey(null);
  }

  function openDetail(item: CraneListItem) {
    setSelectedKey(item.key);
    focusCraneDetail(item.index);
  }

  if (selected) {
    const twin = getCraneTwinProfile(selected.index);

    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.crane}
        title={selected.title}
        subtitle={`${twin.craneId} · ${twin.assignedVessel}`}
        titleClassName="cyber-detail-title"
        onBack={handleBack}
        tracking={selectedCraneIndex === selected.index}
        onTrack={() => selectCrane(selected.index)}
        onClearTrack={clearCraneSelection}
        onDetailClick={() =>
          toggleDetailGraph({
            kind: "crane",
            key: selected.key,
            index: selected.index,
          })
        }
        detailGraphActive={
          detailGraphOpen &&
          detailGraphSubject?.kind === "crane" &&
          detailGraphSubject.key === selected.key
        }
      >
        <DetailFields rows={craneTwinDetailRows(twin)} />
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
        {items.map((item) => {
          const twin = getCraneTwinProfile(item.index);
          const statusTone = craneOperationalTone(twin.status);
          const statusLabel = craneStatusLabel(twin.status);

          return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => openDetail(item)}
              className={cn(
                "cyber-list-row flex w-full items-center gap-sm px-xl py-sm text-left",
                selectedCraneIndex === item.index && "bg-cyber/8",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-sm text-lg">
                <CraneStatusDot
                  tone={statusTone}
                  label={statusLabel}
                  className="mt-[0.5em] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug text-text-primary">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate leading-snug text-text-secondary">
                    {item.subtitle}
                  </p>
                </div>
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
          );
        })}
      </ul>
    </div>
  );
}
