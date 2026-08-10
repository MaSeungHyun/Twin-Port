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
    <span
      className="mr-1"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            aria-label="블록 정렬"
            title="정렬"
            className="rounded p-1 text-white/55 hover:text-white"
          >
            <Icon icon="ArrowUpDown" className="size-3.5 stroke-current" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="center"
          sideOffset={4}
          className="min-w-32"
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
    </span>
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
      className={cn("pl-8", selected && "text-white")}
      onSelect={onSelect}
    >
      {selected ? (
        <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          <Icon icon="Check" className="size-3.5 stroke-primary" />
        </span>
      ) : null}
      {children}
    </DropdownMenu.Item>
  );
}
