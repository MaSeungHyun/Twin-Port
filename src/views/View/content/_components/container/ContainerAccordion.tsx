import { Accordion } from "@/components/Accordion";
import { searchContainers } from "@/domain/containerSearch";
import type { Container } from "@/types/container";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { companyAccent } from "../../util/containerAccent";
import ContainerDetailCard from "./ContainerDetailCard";
import ContainerPreviewRow from "./ContainerPreviewRow";

const MAX_PER_COMPANY_PREVIEW = 12;
const SEARCH_PAGE_SIZE = 10;
const SEARCH_MAX_RESULTS = 100;

type ContainerAccordionProps = {
  query: string;
};

export default function ContainerAccordion({
  query,
}: ContainerAccordionProps) {
  const selectContainer = useViewportStore((s) => s.selectContainer);
  const clearContainerSelection = useViewportStore(
    (s) => s.clearContainerSelection,
  );
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const detailContainerId = useContentViewStore((s) => s.detailContainerId);
  const setDetailContainerId = useContentViewStore((s) => s.setDetailContainerId);

  const containers = useYardStore((s) => s.containers);
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE_SIZE);
  const [countQuery, setCountQuery] = useState(query);
  if (query !== countQuery) {
    setCountQuery(query);
    setVisibleCount(SEARCH_PAGE_SIZE);
  }

  const results = useMemo(
    () =>
      searchContainers(
        containers,
        query,
        Math.min(visibleCount, SEARCH_MAX_RESULTS) + 1,
      ),
    [containers, query, visibleCount],
  );

  const shownCount = Math.min(visibleCount, SEARCH_MAX_RESULTS);
  const shown = results.slice(0, shownCount);

  const loadMore = useCallback(() => {
    setVisibleCount((count) =>
      Math.min(count + SEARCH_PAGE_SIZE, SEARCH_MAX_RESULTS),
    );
  }, []);

  const companyGroups = useMemo(() => {
    const groups = new Map<string, Container[]>();
    for (const container of containers) {
      const list = groups.get(container.company) ?? [];
      list.push(container);
      groups.set(container.company, list);
    }
    return [...groups.entries()]
      .map(([company, items]) => ({ company, items, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [containers]);

  const searching = query.trim().length > 0;
  const detailContainer =
    detailContainerId != null
      ? (containers.find((item) => item.id === detailContainerId) ?? null)
      : null;

  function openDetail(container: Container) {
    setDetailContainerId(container.id);
  }

  function handleBack() {
    if (detailContainerId && selectedContainerId === detailContainerId) {
      clearContainerSelection();
    }
    setDetailContainerId(null);
  }

  if (detailContainer) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ContainerDetailCard
          container={detailContainer}
          tracking={selectedContainerId === detailContainer.id}
          onBack={handleBack}
          onTrack={() => selectContainer(detailContainer.id)}
          onClearTrack={clearContainerSelection}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {searching ? (
        results.length === 0 ? (
          <p className="px-xl py-md text-lg text-white/45">검색 결과 없음</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-xs">
            {shown.map((container) => (
              <li
                key={container.id}
                className="border-b border-white/5 last:border-b-0"
              >
                <ContainerPreviewRow
                  container={container}
                  tracking={selectedContainerId === container.id}
                  onSelect={() => openDetail(container)}
                />
              </li>
            ))}

            <li>
              <LoadMoreSentinel
                onVisible={loadMore}
                resetKey={`${query}:${shownCount}`}
              />
            </li>
          </ul>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Accordion type="multiple" className="w-full px-xl">
            {companyGroups.map(({ company, items, count }) => {
              const accent = companyAccent(company);
              const preview = items.slice(0, MAX_PER_COMPANY_PREVIEW);

              return (
                <Accordion.Item key={company} value={company}>
                  <Accordion.Header className="flex">
                    <Accordion.Trigger
                      className="py-sm text-lg"
                      style={{ "--company-accent": accent } as CSSProperties}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-xs">
                        <span className="size-xs shrink-0 rounded-full bg-text-secondary group-hover:bg-(--company-accent)" />
                        <span className="truncate font-semibold">{company}</span>
                      </span>
                      <span className="mr-1 tabular-nums text-white/50">
                        {count.toLocaleString()}
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="px-0">
                    <ul className="flex flex-col border-t border-white/5">
                      {preview.map((container) => (
                        <li key={container.id}>
                          <ContainerPreviewRow
                            container={container}
                            tracking={selectedContainerId === container.id}
                            onSelect={() => openDetail(container)}
                          />
                        </li>
                      ))}
                    </ul>
                    {count > MAX_PER_COMPANY_PREVIEW ? (
                      <p className="px-xs py-1.5 text-lg text-white/35">
                        +{(count - MAX_PER_COMPANY_PREVIEW).toLocaleString()}개
                        — 검색으로 찾기
                      </p>
                    ) : null}
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
}

function LoadMoreSentinel({
  onVisible,
  resetKey,
}: {
  onVisible: () => void;
  resetKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const root = target.closest(".overflow-y-auto") as HTMLElement | null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisible();
      },
      { root, rootMargin: "80px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onVisible, resetKey]);

  return <div ref={ref} className="h-md" aria-hidden />;
}
