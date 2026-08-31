import Icon from "@/components/Icon";
import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";
import { cn } from "@/utils/style";
import { companyAccent } from "../../util/containerAccent";

type ContainerPreviewRowProps = {
  container: Container;
  tracking: boolean;
  onSelect: () => void;
};

export default function ContainerPreviewRow({
  container,
  tracking,
  onSelect,
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "cyber-list-row flex w-full items-center gap-sm px-xl py-sm text-left",
        tracking && "bg-cyber/8",
      )}
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-lg font-medium text-text-primary">
          {container.id}
        </p>
        <p
          className="mt-0.5 truncate text-lg font-medium"
          style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}
        >
          {container.company}
        </p>
        <p className="mt-0.5 truncate text-lg text-text-secondary tabular-nums">
          {address}
        </p>
        <p className="mt-0.5 truncate text-lg text-text-secondary">
          {container.status}
          {container.destination ? ` · ${container.destination}` : ""}
        </p>
      </div>
      {tracking ? (
        <Icon icon="Focus" className="size-lg shrink-0 stroke-cyber" />
      ) : (
        <Icon icon="ChevronRight" className="size-lg shrink-0 stroke-cyber/50" />
      )}
    </button>
  );
}
