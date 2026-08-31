import { Accordion } from "@/components/Accordion";
import SearchBar from "@/components/SearchBar";
import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { memo, useDeferredValue } from "react";
import ContainerAccordion from "./ContainerAccordion";
import { useContainerQueryStore } from "./containerQueryStore";
import { useContainerPanel } from "./useContainerPanel";
import { CyberHeading } from "../cyber/CyberPanel";
import { useContentViewStore } from "@/stores/contentView";
type ContainerContentAccordionProps = {
  onOpenChange?: (open: boolean) => void;
  /** ContentPanel 등 단일 탭 — 최상위 Accordion 없이 항상 펼침 */
  flat?: boolean;
};

const ContainerList = memo(ContainerAccordion);

function DeferredContainerList() {
  const query = useContainerQueryStore((s) => s.query);
  const deferredQuery = useDeferredValue(query);
  return <ContainerList query={deferredQuery} />;
}

function PanelSearchBar({
  panelOpen,
  onNeedOpen,
}: {
  panelOpen: boolean;
  onNeedOpen: () => void;
}) {
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
          if (next.trim() && !panelOpen) onNeedOpen();
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

export default function ContainerContentAccordion({
  onOpenChange,
  flat = false,
}: ContainerContentAccordionProps) {
  const { value, open, onValueChange, openPanel } =
    useContainerPanel(onOpenChange);
  const detailContainerId = useContentViewStore((s) => s.detailContainerId);
  const showListChrome = detailContainerId == null;
  const showSearchBar = showListChrome;

  if (flat) {
    return (
      <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden gap-2">
        {showListChrome ? <CyberHeading title="Containers" /> : null}
        {showSearchBar ? (
          <PanelSearchBar panelOpen onNeedOpen={() => {}} />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DeferredContainerList />
        </div>
      </div>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={onValueChange}
      className={cn(
        "flex flex-col overflow-hidden rounded-md bg-background/70 backdrop-blur-sm",
        open ? "min-h-0 flex-1" : "shrink-0",
      )}
    >
      <Accordion.Item
        value="containers"
        className={cn(
          "flex flex-col overflow-hidden border-b-0",
          open && "min-h-0 flex-1",
        )}
      >
        {showListChrome ? (
          <Accordion.Header className="flex">
            <Accordion.Trigger className="shrink-0 px-xl py-xs text-xl">
              Containers
            </Accordion.Trigger>
          </Accordion.Header>
        ) : null}
        {showSearchBar ? (
          <PanelSearchBar panelOpen={open} onNeedOpen={openPanel} />
        ) : null}
        <Accordion.Content className="min-h-0 overflow-y-auto overscroll-contain data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
          <DeferredContainerList />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
