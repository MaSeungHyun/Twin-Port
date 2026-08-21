import { Accordion } from "@/components/Accordion";
import SearchBar from "@/components/SearchBar";
import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { memo, useDeferredValue } from "react";
import ContainerAccordion from "./ContainerAccordion";
import { useContainerQueryStore } from "./containerQueryStore";
import { useContainerPanel } from "./useContainerPanel";

type ContainerContentAccordionProps = {
  onOpenChange?: (open: boolean) => void;
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
    <div className="shrink-0 px-2 pb-2">
      <SearchBar
        size="sm"
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
      <p
        className={cn(
          "mt-1 flex h-4 items-center gap-1 text-[11px]",
          isSearching ? "text-white/50" : "text-transparent",
        )}
        aria-live="polite"
      >
        <Icon
          icon="LoaderCircle"
          className={cn("size-3 stroke-current", isSearching && "animate-spin")}
        />
        검색 중
      </p>
    </div>
  );
}

export default function ContainerContentAccordion({
  onOpenChange,
}: ContainerContentAccordionProps) {
  const { value, open, onValueChange, openPanel } =
    useContainerPanel(onOpenChange);

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
        <Accordion.Header className="flex">
          <Accordion.Trigger className="shrink-0 px-3 py-2 text-sm">
            Containers
          </Accordion.Trigger>
        </Accordion.Header>
        <PanelSearchBar panelOpen={open} onNeedOpen={openPanel} />
        <Accordion.Content className="min-h-0 overflow-y-auto overscroll-contain px-1 data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
          <DeferredContainerList />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
