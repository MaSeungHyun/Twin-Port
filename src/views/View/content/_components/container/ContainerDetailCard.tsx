import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";
import { cn } from "@/utils/style";
import { companyAccent } from "../../util/containerAccent";

type ContainerDetailCardProps = {
  container: Container;
  selected: boolean;
  onTrack: () => void;
  onClearTrack: () => void;
};

export default function ContainerDetailCard({
  container,
  selected,
  onTrack,
  onClearTrack,
}: ContainerDetailCardProps) {
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
      className={cn(
        "rounded-md border border-white/10 bg-black/30 px-2.5 py-2",
        selected && "border-primary/50 bg-primary/15",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            {container.id}
          </p>
          <p
            className="mt-0.5 text-[11px] font-semibold"
            style={{ color: accent }}
          >
            {address}
          </p>
        </div>
        <Button
          type="button"
          onClick={selected ? onClearTrack : onTrack}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold text-white",
            selected
              ? "border-white/20 bg-white/10 hover:bg-white/20"
              : "border-primary/40 bg-primary/20 hover:bg-primary/35",
          )}
        >
          <Icon
            icon={selected ? "CircleX" : "Focus"}
            className={cn(
              "size-3",
              selected ? "stroke-white/80" : "stroke-primary",
            )}
          />
          {selected ? "Cancel" : "Tracking"}
        </Button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <Field label="id" value={container.id} />
        <Field label="company" value={container.company} />
        <Field label="status" value={container.status} />
        <Field label="block" value={block} />
        <Field label="bay" value={slot.bay} />
        <Field label="row" value={slot.row} />
        <Field label="tier" value={slot.tier} />
        <Field label="destination" value={container.destination || "—"} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-white/40">{label}</dt>
      <dd className="truncate font-medium text-white/90 tabular-nums">
        {value}
      </dd>
    </>
  );
}
