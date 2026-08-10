import { Accordion } from "@/components/Accordion";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import SearchBar from "@/components/SearchBar";
import { searchContainers } from "@/domain/containerSearch";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useViewportStore } from "@/stores/viewport";
import { useDeferredValue, useMemo, useState } from "react";
import { companyAccent } from "../../util/containerAccent";
import ContainerDetailCard from "./ContainerDetailCard";
import ContainerPreviewRow from "./ContainerPreviewRow";

const MAX_PER_COMPANY_PREVIEW = 12;

export default function ContainerAccordion() {
  const selectContainer = useViewportStore((s) => s.selectContainer);
  const clearContainerSelection = useViewportStore(
    (s) => s.clearContainerSelection,
  );
  const selectedContainerId = useViewportStore((s) => s.selectedContainerId);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const containers = mockContainers as Container[];

  const results = useMemo(
    () => searchContainers(containers, deferredQuery),
    [containers, deferredQuery],
  );

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

  const searching = deferredQuery.trim().length > 0;

  function focusContainer(container: Container) {
    setQuery(container.id);
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 -mx-1 space-y-1.5 bg-background/90 px-1 pb-2 backdrop-blur-sm">
        <SearchBar
          size="sm"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            clearContainerSelection();
          }}
          placeholder="ID · 선사 · 슬롯 검색"
          className="border-white/15 bg-black/35"
          aria-label="컨테이너 검색"
        />

        {selectedContainerId ? (
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
        ) : null}
      </div>

      {searching ? (
        results.length === 0 ? (
          <p className="px-2 py-3 text-xs text-white/45">검색 결과 없음</p>
        ) : (
          <ul className="flex flex-col gap-2 px-1 pb-2">
            {results.map((container) => (
              <li key={container.id}>
                <ContainerDetailCard
                  container={container}
                  selected={selectedContainerId === container.id}
                  onTrack={() => selectContainer(container.id)}
                  onClearTrack={clearContainerSelection}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <Accordion type="multiple" className="w-full">
          {companyGroups.map(({ company, items, count }) => {
            const accent = companyAccent(company);
            const preview = items.slice(0, MAX_PER_COMPANY_PREVIEW);

            return (
              <Accordion.Item key={company} value={company}>
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
