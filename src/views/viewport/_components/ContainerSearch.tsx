import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";

import { formatSlotAddress } from "@/domain/container";
import { searchContainers } from "@/domain/containerSearch";
import type { Container } from "@/types/container";
import mockContainers from "@/data/container_mock.json";
import { useViewportStore } from "@/stores/viewport";
import { useDeferredValue, useMemo, useState } from "react";

const MAX_RESULTS = 8;

export default function ContainerSearch() {
  const selectContainer = useViewportStore((s) => s.selectContainer);
  const clearContainerSelection = useViewportStore(
    (s) => s.clearContainerSelection,
  );
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () =>
      searchContainers(
        mockContainers as Container[],
        deferredQuery,
        MAX_RESULTS,
      ),
    [deferredQuery],
  );

  const showPanel = panelOpen && deferredQuery.trim().length > 0;

  function selectFromList(container: Container) {
    setQuery(container.id);
    selectContainer(container.id);
    setPanelOpen(false);
  }

  return (
    <div className="relative w-64">
      <SearchBar
        size="md"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          clearContainerSelection();
          setPanelOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setPanelOpen(true);
        }}
        placeholder="컨테이너 ID 검색 (예: CONT-0001)"
        className="border-white/15 bg-black/45 shadow backdrop-blur-md"
        aria-label="컨테이너 검색"
      />

      {showPanel ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-sm border border-white/10 bg-background/75 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-white/45">검색 결과 없음</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((container) => {
                const { block, slot } = container.location;
                const address = formatSlotAddress(
                  block,
                  Number(slot.bay),
                  Number(slot.row),
                  Number(slot.tier),
                );

                return (
                  <li key={container.id}>
                    <Button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectFromList(container)}
                      className="w-full border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-primary/15"
                    >
                      <p className="text-sm font-semibold text-white">
                        {container.id}
                      </p>
                      <p className="mt-0.5 text-xs text-primary font-semibold">
                        {address}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {container.company} · Bay {slot.bay} · Row {slot.row} ·
                        Tier {slot.tier}
                      </p>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
