import Button from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import type { ReactNode } from "react";
import type { BlockSortBy, BlockSortOrder } from "./BlockAccordion";

type BlockSortDropdownProps = {
  sortBy: BlockSortBy;
  sortOrder: BlockSortOrder;
  onSortByChange: (value: BlockSortBy) => void;
  onSortOrderChange: (value: BlockSortOrder) => void;
};

export default function BlockSortDropdown({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: BlockSortDropdownProps) {
  return (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            aria-label="블록 정렬"
            title="정렬"
            className="rounded p-1 text-white/55 hover:text-white"
          >
            <Icon icon="ArrowUpDown" className="size-lg stroke-current" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="center"
          sideOffset={4}
          className="min-w-40 p-sm text-lg"
        >
          <SortOption
            selected={sortBy === "name"}
            onSelect={() => onSortByChange("name")}
          >
            이름순
          </SortOption>
          <SortOption
            selected={sortBy === "occupancy"}
            onSelect={() => onSortByChange("occupancy")}
          >
            적재순
          </SortOption>
          <DropdownMenu.Separator />
          <SortOption
            selected={sortOrder === "desc"}
            onSelect={() => onSortOrderChange("desc")}
          >
            높은 순
          </SortOption>
          <SortOption
            selected={sortOrder === "asc"}
            onSelect={() => onSortOrderChange("asc")}
          >
            낮은 순
          </SortOption>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

function SortOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      className={cn("py-xs pl-9 text-xl", selected && "text-white")}
      onSelect={onSelect}
    >
      {selected ? (
        <span className="pointer-events-none absolute left-2 flex size-xl items-center justify-center">
          <Icon icon="Check" className="size-lg stroke-primary" />
        </span>
      ) : null}
      {children}
    </DropdownMenu.Item>
  );
}
