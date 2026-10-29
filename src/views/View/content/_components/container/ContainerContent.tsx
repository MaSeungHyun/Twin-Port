import SearchBar from "@/components/SearchBar";
import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { memo, useDeferredValue } from "react";
import ContainerAccordion from "./ContainerAccordion";
import { useContainerQueryStore } from "./containerQueryStore";
import { CyberHeading } from "../cyber/CyberPanel";
import { useContentViewStore } from "@/stores/contentView";

const ContainerList = memo(ContainerAccordion);

function DeferredContainerList() {
  const query = useContainerQueryStore((s) => s.query);
  const deferredQuery = useDeferredValue(query);
  return <ContainerList query={deferredQuery} />;
}

function PanelSearchBar() {
  const query = useContainerQueryStore((s) => s.query);
  const setQuery = useContainerQueryStore((s) => s.setQuery);
  const deferredQuery = useDeferredValue(query);
  const isSearching = query.trim() !== deferredQuery.trim();

  return (
    <div className="shrink-0 px-xl pb-xs">
      <SearchBar
        size="md"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          const selectedId = useViewportStore.getState().selectedContainerId;
          if (selectedId) {
            useViewportStore.getState().clearContainerSelection();
          }
        }}
        placeholder="ID · 선사 · 슬롯 검색"
        className="border-white/15 bg-black/35"
        aria-label="컨테이너 검색"
      />
      {isSearching && (
        <p
          className={cn(
            "mt-1.5 flex h-xl items-center gap-1 text-lg",
            isSearching ? "text-white/50" : "text-transparent",
          )}
          aria-live="polite"
        >
          <Icon
            icon="LoaderCircle"
            className={cn(
              "size-md stroke-current",
              isSearching && "animate-spin",
            )}
          />
          검색 중
        </p>
      )}
    </div>
  );
}

export default function ContainerContent() {
  const detailContainerId = useContentViewStore((s) => s.detailContainerId);
  const showListChrome = detailContainerId == null;
  const showSearchBar = showListChrome;

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden gap-2">
      {showListChrome ? <CyberHeading title="Containers" /> : null}
      {showSearchBar ? <PanelSearchBar /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DeferredContainerList />
      </div>
    </div>
  );
}
