import { Accordion } from "@/components/Accordion";
import { cn } from "@/utils/style";
import { useState } from "react";
import BlockAccordion, {
  type BlockSortBy,
  type BlockSortOrder,
} from "./BlockAccordion";
import BlockSortDropdown from "./BlockSortDropdown";

type BlockContentAccordionProps = {
  /** 컨테이너 패널이 열려 있으면 높이 절반으로 제한 */
  siblingOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function BlockContentAccordion({
  siblingOpen = false,
  onOpenChange,
}: BlockContentAccordionProps) {
  const [value, setValue] = useState("blocks");
  const [sortBy, setSortBy] = useState<BlockSortBy>("name");
  const [sortOrder, setSortOrder] = useState<BlockSortOrder>("asc");
  const open = value === "blocks";

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onOpenChange?.(next === "blocks");
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-md bg-background/70 backdrop-blur-sm",
        open
          ? siblingOpen
            ? "max-h-[40%] min-h-0 shrink-0"
            : "min-h-0 flex-1"
          : "shrink-0",
      )}
    >
      <Accordion.Item
        value="blocks"
        className={cn(
          "flex flex-col overflow-hidden border-b-0",
          open && "min-h-0 flex-1",
        )}
      >
        <Accordion.Header className="flex shrink-0 items-center gap-1 px-2">
          <Accordion.Trigger hideIcon className="px-1 py-2 text-sm">
            <span className="flex-1 text-left">Blocks</span>
          </Accordion.Trigger>
          <BlockSortDropdown
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={setSortBy}
            onSortOrderChange={setSortOrder}
          />
          <Accordion.Trigger
            className="flex-none px-1 py-2"
            aria-label="블록 목록 열기"
          />
        </Accordion.Header>
        <Accordion.Content className="min-h-0 overflow-y-auto overscroll-contain px-1 data-[state=open]:flex data-[state=open]:flex-1 data-[state=open]:flex-col">
          <BlockAccordion sortBy={sortBy} sortOrder={sortOrder} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
