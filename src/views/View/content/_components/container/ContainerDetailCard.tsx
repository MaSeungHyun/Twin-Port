import { CONTENT_THUMBNAILS } from "@/assets/image/thumbnail";
import { formatSlotAddress } from "@/domain/container";
import type { Container } from "@/types/container";
import { companyAccent } from "../../util/containerAccent";
import ContentDetailLayout, { DetailFields } from "../ContentDetailLayout";

type ContainerDetailCardProps = {
  container: Container;
  tracking: boolean;
  onBack: () => void;
  onTrack: () => void;
  onClearTrack: () => void;
};

export default function ContainerDetailCard({
  container,
  tracking,
  onBack,
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
    <ContentDetailLayout
      thumbnail={CONTENT_THUMBNAILS.container}
      title={container.id}
      subtitle={
        <span
          className="truncate font-medium"
          style={{ color: accent, textShadow: `0 0 12px ${accent}88` }}
        >
          {container.company}
        </span>
      }
      compactHero
      onBack={onBack}
      tracking={tracking}
      onTrack={onTrack}
      onClearTrack={onClearTrack}
    >
      <div className="mb-xs min-w-0 text-left">
        <p className="container-address-line text-text-secondary tabular-nums">
          {address}
        </p>
        <p className="cyber-subheading mt-0.5 truncate">
          {container.status}
          {container.destination ? ` · ${container.destination}` : ""}
        </p>
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
    </ContentDetailLayout>
  );
}
