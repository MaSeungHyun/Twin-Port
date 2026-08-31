import {
  type DetailGraphSubject,
  useContentViewStore,
} from "@/stores/contentView";
import {
  craneOperationalTone,
  craneStatusLabel,
  getCraneTwinProfile,
  getShipTwinProfile,
  shipStatusLabel,
} from "@/domain/portTwinMock";
import { cn } from "@/utils/style";
import Button from "@/components/Button";
import CraneDetailGraphView from "./detail/CraneDetailGraphView";
import ShipDetailGraphView from "./detail/ShipDetailGraphView";
import OperationalStatusIndicator from "./detail/OperationalStatusIndicator";
import CyberPanel, { CyberHeading } from "./cyber/CyberPanel";

type ContentDetailGraphPanelProps = {
  subject: DetailGraphSubject;
  className?: string;
};

function graphHeader(subject: DetailGraphSubject) {
  if (subject.kind === "crane") {
    const twin = getCraneTwinProfile(subject.index);
    return {
      title: `Crane ${String(subject.index).padStart(2, "0")}`,
      subtitle: (
        <OperationalStatusIndicator
          label={craneStatusLabel(twin.status)}
          tone={craneOperationalTone(twin.status)}
        />
      ),
    };
  }

  const twin = getShipTwinProfile(subject.index);
  return {
    title: twin.vesselName,
    subtitle: (
      <p className="cyber-subheading">{shipStatusLabel(twin.status)}</p>
    ),
  };
}

export default function ContentDetailGraphPanel({
  subject,
  className,
}: ContentDetailGraphPanelProps) {
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);
  const header = graphHeader(subject);

  return (
    <CyberPanel
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col backdrop-blur-md",
        className,
      )}
    >
      <CyberHeading
        title={header.title}
        subtitle={header.subtitle}
        className="pr-xl"
      />

      <div className="flex min-h-0 flex-1 flex-col px-xl py-sm">
        {subject.kind === "crane" ? (
          <CraneDetailGraphView
            index={subject.index}
            subjectKey={subject.key}
          />
        ) : (
          <ShipDetailGraphView
            index={subject.index}
            subjectKey={subject.key}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-cyber/15 px-xl py-sm">
        <Button
          type="button"
          onClick={closeDetailGraph}
          className="cyber-btn w-full py-2 text-lg font-semibold"
        >
          Close
        </Button>
      </div>
    </CyberPanel>
  );
}
