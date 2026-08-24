import { Accordion } from "@/components/Accordion";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { searchContainers } from "@/domain/containerSearch";
import type { Container } from "@/types/container";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { companyAccent } from "../../util/containerAccent";
import { useContainerQueryStore } from "./containerQueryStore";
import ContainerDetailCard from "./ContainerDetailCard";
import ContainerPreviewRow from "./ContainerPreviewRow";

const MAX_PER_COMPANY_PREVIEW = 12;
const SEARCH_PAGE_SIZE = 10;
const SEARCH_MAX_RESULTS = 100;

type ContainerAccordionProps = {
  query: string;
};

export default function ContainerAccordion({ query }: ContainerAccordionProps) {
  const selectContainer = useViewportStore((s) => s.selectContainer);
  const clearContainerSelection = useViewportStore(
    (s) => s.clearContainerSelection,
  );
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);
  const setQuery = useContainerQueryStore((s) => s.setQuery);

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
  const hasMore = results.length > shownCount && shownCount < SEARCH_MAX_RESULTS;

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

  function focusContainer(container: Container) {
    setQuery(container.id);
  }

  return (
    <div className="flex flex-col">
      {selectedContainerId ? (
        <div className="sticky top-0 z-10 -mx-1 space-y-1.5 bg-background/90 px-1 pb-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/15 px-2 py-1.5">
            <Icon icon="Focus" className="size-3.5 shrink-0 stroke-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">
              {selectedContainerId}
            </span>
            <Button
              type="button"
              onClick={clearContainerSelection}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/10"
            >
              <Icon icon="CircleX" className="size-3 stroke-white/80" />
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {searching ? (
        results.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/45">검색 결과 없음</p>
        ) : (
          <ul className="flex flex-col gap-2 px-1 pb-2">
            {shown.map((container) => (
              <li key={container.id}>
                <ContainerDetailCard
                  container={container}
                  selected={selectedContainerId === container.id}
                  onTrack={() => selectContainer(container.id)}
                  onClearTrack={clearContainerSelection}
                />
              </li>
            ))}
            {hasMore ? (
              <li>
                <LoadMoreSentinel
                  onVisible={loadMore}
                  resetKey={`${query}:${shownCount}`}
                />
              </li>
            ) : shownCount >= SEARCH_MAX_RESULTS ? (
              <li className="px-2 py-1 text-[11px] text-white/35">
                상위 {SEARCH_MAX_RESULTS}개만 표시 — 검색어를 더 입력해 주세요
              </li>
            ) : null}
          </ul>
        )
      ) : (
        <Accordion type="multiple" className="w-full">
          {companyGroups.map(({ company, items, count }) => {
            const accent = companyAccent(company);
            const preview = items.slice(0, MAX_PER_COMPANY_PREVIEW);

            return (
              <Accordion.Item key={company} value={company}>
                <Accordion.Header className="flex">
                  <Accordion.Trigger className="px-2 py-2.5 text-xs">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
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
                          selected={selectedContainerId === container.id}
                          onSelect={() => focusContainer(container)}
                          onTrack={() => selectContainer(container.id)}
                          onClearTrack={clearContainerSelection}
                        />
                      </li>
                    ))}
                  </ul>
                  {count > MAX_PER_COMPANY_PREVIEW ? (
                    <p className="px-2 py-1.5 text-[11px] text-white/35">
                      +{(count - MAX_PER_COMPANY_PREVIEW).toLocaleString()}개 —
                      검색으로 찾기
                    </p>
                  ) : null}
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion>
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

    const root = target.closest(
      "[data-slot='accordion-content']",
    ) as HTMLElement | null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisible();
      },
      { root, rootMargin: "80px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onVisible, resetKey]);

  return <div ref={ref} className="h-3" aria-hidden />;
}
