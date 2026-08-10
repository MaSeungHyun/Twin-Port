import { Accordion } from "@/components/Accordion";
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
  const open = value === "containers";

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
        <Accordion.Content className="min-h-0 overflow-y-auto overscroll-contain px-1 data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
          <ContainerAccordion />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
