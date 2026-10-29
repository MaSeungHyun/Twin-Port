import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Icon from "@/components/Icon";
import { getCraneListSource } from "@/domain/cameraFocus";
import {
  craneTwinDetailRows,
  craneOperationalTone,
  craneStatusLabel,
  getCraneTwinProfile,
} from "@/domain/portTwinMock";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { isFailed, useFailureStore } from "@/stores/useFailureStore";
import { cn } from "@/utils/style";
import { useMemo, type ReactNode } from "react";
import {
  getOverheadCraneTwinProfile,
  overheadCraneKey,
  overheadCraneTitle,
  overheadCraneTwinDetailRows,
} from "@/domain/overheadCraneTwin";
import { type CraneTab } from "@/stores/contentView";
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

function QuayCraneSection({ tabs }: { tabs: ReactNode }) {
  const quayCranes = useYardStore((s) => s.quayCranes);
  const failures = useFailureStore((s) => s.active);
  const selectedCraneIndex = useViewportStore((s) => s.selectedCraneIndex);
  const selectCrane = useViewportStore((s) => s.selectCrane);
  const clearCraneSelection = useViewportStore((s) => s.clearCraneSelection);
  const clearCraneDetailFocus = useViewportStore((s) => s.clearCraneDetailFocus);
  const detailCraneKey = useContentViewStore((s) => s.detailCraneKey);
  const openCraneDetail = useContentViewStore((s) => s.openCraneDetail);
  const clearContentDetail = useContentViewStore((s) => s.clearContentDetail);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const toggleDetailGraph = useContentViewStore((s) => s.toggleDetailGraph);
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);

  const items = useMemo<CraneListItem[]>(() => {
    const { placements } =
      quayCranes.length > 0
        ? { placements: quayCranes }
        : getCraneListSource();
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

  const selected = items.find((item) => item.key === detailCraneKey) ?? null;

  function handleBack() {
    clearCraneDetailFocus();
    clearContentDetail();
    closeDetailGraph();
  }

  function openDetail(item: CraneListItem) {
    openCraneDetail(item.key);
  }

  if (selected) {
    const baseTwin = getCraneTwinProfile(selected.index);
    const twin = isFailed(failures, "quayCrane", selected.index)
      ? { ...baseTwin, status: "error" as const }
      : baseTwin;

    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.crane}
        title={selected.title}
        subtitle={`${twin.craneId} · ${twin.assignedVessel}`}
        titleClassName="cyber-detail-title"
        compactHero
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
      {tabs}

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => {
          const twin = getCraneTwinProfile(item.index);
          const failed = isFailed(failures, "quayCrane", item.index);
          const statusTone = failed ? "error" : craneOperationalTone(twin.status);
          const statusLabel = failed ? "고장" : craneStatusLabel(twin.status);

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
                  className={cn("mt-[0.5em] shrink-0", failed && "animate-pulse")}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-sm truncate font-medium leading-snug text-text-primary">
                    <span className="truncate">{item.title}</span>
                    {failed ? <span className="shrink-0 animate-pulse text-danger">고장</span> : null}
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

const CRANE_TABS: { tab: CraneTab; label: string }[] = [
  { tab: "quay", label: "컨테이너 크레인" },
  { tab: "overhead", label: "오버헤드 크레인" },
];

function CraneTabs() {
  const craneTab = useContentViewStore((s) => s.craneTab);
  const setCraneTab = useContentViewStore((s) => s.setCraneTab);

  return (
    <div
      role="tablist"
      className="flex shrink-0 gap-sm border-b border-cyber/15 px-xl pb-sm"
    >
      {CRANE_TABS.map(({ tab, label }) => {
        const active = craneTab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setCraneTab(tab)}
            className={cn(
              "flex-1 border py-1.5 text-lg font-medium transition-colors",
              active
                ? "border-cyber/60 bg-cyber/12 text-cyber"
                : "border-cyber/15 text-text-secondary hover:border-cyber/35 hover:text-text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

type OverheadCraneListItem = {
  key: string;
  index: number;
  title: string;
  subtitle: string;
};

function OverheadCraneSection({ tabs }: { tabs: ReactNode }) {
  const blocks = useYardStore((s) => s.blocks);
  const failures = useFailureStore((s) => s.active);
  const selectedIndex = useViewportStore((s) => s.selectedOverheadCraneIndex);
  const selectOverheadCrane = useViewportStore((s) => s.selectOverheadCrane);
  const clearOverheadCraneSelection = useViewportStore(
    (s) => s.clearOverheadCraneSelection,
  );
  const clearOverheadCraneDetailFocus = useViewportStore(
    (s) => s.clearOverheadCraneDetailFocus,
  );
  const detailKey = useContentViewStore((s) => s.detailOverheadCraneKey);
  const openDetail = useContentViewStore((s) => s.openOverheadCraneDetail);
  const clearContentDetail = useContentViewStore((s) => s.clearContentDetail);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const toggleDetailGraph = useContentViewStore((s) => s.toggleDetailGraph);
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);

  const items = useMemo<OverheadCraneListItem[]>(() => {
    // createBlockCenterCraneInstances 와 동일 순서 — 블록당 1대
    return blocks.map((block, index) => {
      const twin = getOverheadCraneTwinProfile(index);
      return {
        key: overheadCraneKey(index),
        index,
        title: overheadCraneTitle(index),
        subtitle: `${twin.craneId} · Block ${block.code} · ${twin.containersMoved.toLocaleString()} moves`,
      };
    });
  }, [blocks]);

  const selected = items.find((item) => item.key === detailKey) ?? null;

  function handleBack() {
    clearOverheadCraneDetailFocus();
    clearContentDetail();
    closeDetailGraph();
  }

  if (selected) {
    const baseTwin = getOverheadCraneTwinProfile(selected.index);
    const twin = isFailed(failures, "overheadCrane", selected.index)
      ? { ...baseTwin, status: "error" as const }
      : baseTwin;

    return (
      <ContentDetailLayout
        thumbnail={CONTENT_THUMBNAILS.crane}
        title={selected.title}
        subtitle={`${twin.craneId} · ${twin.assignedVessel}`}
        titleClassName="cyber-detail-title"
        compactHero
        onBack={handleBack}
        tracking={selectedIndex === selected.index}
        onTrack={() => selectOverheadCrane(selected.index)}
        onClearTrack={clearOverheadCraneSelection}
        onDetailClick={() =>
          toggleDetailGraph({
            kind: "overheadCrane",
            key: selected.key,
            index: selected.index,
          })
        }
        detailGraphActive={
          detailGraphOpen &&
          detailGraphSubject?.kind === "overheadCrane" &&
          detailGraphSubject.key === selected.key
        }
      >
        <DetailFields rows={overheadCraneTwinDetailRows(twin)} />
      </ContentDetailLayout>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <CyberHeading
        title="Cranes"
        subtitle={`${items.length} overhead cranes`}
      />
      {tabs}

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => {
          const twin = getOverheadCraneTwinProfile(item.index);
          const failed = isFailed(failures, "overheadCrane", item.index);
          const statusTone = failed ? "error" : craneOperationalTone(twin.status);
          const statusLabel = failed ? "고장" : craneStatusLabel(twin.status);

          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => openDetail(item.key)}
                className={cn(
                  "cyber-list-row flex w-full items-center gap-sm px-xl py-sm text-left",
                  selectedIndex === item.index && "bg-cyber/8",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-sm text-lg">
                  <CraneStatusDot
                    tone={statusTone}
                    label={statusLabel}
                    className={cn("mt-[0.5em] shrink-0", failed && "animate-pulse")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-sm truncate font-medium leading-snug text-text-primary">
                      <span className="truncate">{item.title}</span>
                      {failed ? <span className="shrink-0 animate-pulse text-danger">고장</span> : null}
                    </p>
                    <p className="mt-0.5 truncate leading-snug text-text-secondary">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                {selectedIndex === item.index ? (
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

/** 크레인 패널 — 컨테이너(quay) / 오버헤드 탭 */
export default function CraneContentPanel() {
  const craneTab = useContentViewStore((s) => s.craneTab);
  const tabs = <CraneTabs />;
  return craneTab === "overhead" ? (
    <OverheadCraneSection tabs={tabs} />
  ) : (
    <QuayCraneSection tabs={tabs} />
  );
}
