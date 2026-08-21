import { Accordion } from "@/components/Accordion";
import SearchBar from "@/components/SearchBar";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { useState } from "react";
import ContainerAccordion from "./ContainerAccordion";

type ContainerContentAccordionProps = {
  onOpenChange?: (open: boolean) => void;
};

export default function ContainerContentAccordion({
  onOpenChange,
}: ContainerContentAccordionProps) {
  const [value, setValue] = useState("containers");
  const [query, setQuery] = useState("");
  const open = value === "containers";
  const clearContainerSelection = useViewportStore(
    (s) => s.clearContainerSelection,
  );

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onOpenChange?.(next === "containers");
      }}
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
        <div className="shrink-0 px-2 pb-2">
          <SearchBar
            size="sm"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              clearContainerSelection();
              if (next.trim() && !open) {
                setValue("containers");
                onOpenChange?.(true);
              }
            }}
            placeholder="ID · 선사 · 슬롯 검색"
            className="border-white/15 bg-black/35"
            aria-label="컨테이너 검색"
          />
        </div>
        <Accordion.Content className="min-h-0 overflow-y-auto overscroll-contain px-1 data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
          <ContainerAccordion query={query} onQueryChange={setQuery} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
