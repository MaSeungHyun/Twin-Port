import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";
import { cn } from "@/utils/style";
import { companyAccent } from "../../util/containerAccent";
import ContentDetailHero from "../ContentDetailHero";
import { DetailFields } from "../ContentDetailLayout";

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
        "relative z-1 overflow-hidden",
        selected && "bg-cyber/5",
        "hover:bg-cyber/5",
      )}
    >
      <ContentDetailHero
        src={CONTENT_THUMBNAILS.container}
        alt="Container"
        title={container.id}
        subtitle={container.company}
        layout="block"
      />

      <div className="px-xl pb-sm">
        <div className="mb-sm flex items-start justify-between gap-xs">
          <div className="min-w-0">
            <p
              className="cyber-stat-value truncate text-left text-lg"
              style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}
            >
              {address}
            </p>
            <p className="cyber-subheading mt-0.5 truncate">
              {container.status}
              {container.destination ? ` · ${container.destination}` : ""}
            </p>
          </div>
          <Button
            type="button"
            onClick={selected ? onClearTrack : onTrack}
            className={cn(
              "cyber-btn inline-flex shrink-0 items-center gap-1 py-1 text-lg font-semibold",
              selected && "border-white/25!",
            )}
          >
            <Icon
              icon={selected ? "CircleX" : "Focus"}
              className={cn(
                "size-md",
                selected ? "stroke-white/80" : "stroke-cyber-glow",
              )}
            />
            {selected ? "Cancel" : "Tracking"}
          </Button>
        </div>

        <DetailFields
          rows={[
            { label: "id", value: container.id },
            { label: "company", value: container.company },
            { label: "status", value: container.status },
            { label: "block", value: block },
            { label: "bay", value: slot.bay },
            { label: "row", value: slot.row },
            { label: "tier", value: slot.tier },
            { label: "destination", value: container.destination || "—" },
          ]}
        />
      </div>
    </div>
  );
}
