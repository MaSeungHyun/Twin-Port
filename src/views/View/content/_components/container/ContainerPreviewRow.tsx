import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";
import { cn } from "@/utils/style";
import { companyAccent } from "../../util/containerAccent";

type ContainerPreviewRowProps = {
  container: Container;
  selected: boolean;
  onSelect: () => void;
  onTrack: () => void;
  onClearTrack: () => void;
};

export default function ContainerPreviewRow({
  container,
  selected,
  onSelect,
  onTrack,
  onClearTrack,
}: ContainerPreviewRowProps) {
  const { block, slot } = container.location;

  const address = formatSlotAddress(
    block,
    Number(slot.bay),
    Number(slot.row),
    Number(slot.tier),
  );
  const accent = companyAccent(container.company);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-xs border-b border-white/5 px-sm py-xs last:border-b-0 hover:bg-primary/15",
        selected && "bg-primary/20",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {container.id}
        </p>
        <p
          className="mt-0.5 truncate text-sm font-semibold"
          style={{ color: accent }}
        >
          {address}
        </p>
      </div>
      <Button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (selected) onClearTrack();
          else onTrack();
        }}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-xs py-1 text-sm font-semibold text-white",
          selected
            ? "border-white/20 bg-white/10 hover:bg-white/20"
            : "border-primary/40 bg-primary/20 hover:bg-primary/35",
        )}
      >
        <Icon
          icon={selected ? "CircleX" : "Focus"}
          className={cn(
            "size-md",
            selected ? "stroke-white/80" : "stroke-primary",
          )}
        />
        {selected ? "Cancel" : "Tracking"}
      </Button>
    </div>
  );
}
