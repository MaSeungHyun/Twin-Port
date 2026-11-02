import { INFO_TIPS } from "@/constants/infoTips";
import { useState } from "react";
import BlockAccordion, {
  type BlockSortBy,
  type BlockSortOrder,
} from "./BlockAccordion";
import BlockSortDropdown from "./BlockSortDropdown";
import { CyberHeading } from "../cyber/CyberPanel";

export default function BlockContent() {
  const [sortBy, setSortBy] = useState<BlockSortBy>("name");
  const [sortOrder, setSortOrder] = useState<BlockSortOrder>("asc");

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <CyberHeading
        title="Blocks"
        info={INFO_TIPS.blockList}
        trailing={
          <BlockSortDropdown
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={setSortBy}
            onSortOrderChange={setSortOrder}
          />
        }
      />
      <div className="min-h-0 flex-1 scrollbar-themed overflow-y-auto overscroll-contain px-1 py-xs">
        <BlockAccordion sortBy={sortBy} sortOrder={sortOrder} />
      </div>
    </div>
  );
}
