import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";

type ContentTrackButtonProps = {
  active: boolean;
  onTrack: () => void;
  onClearTrack: () => void;
  className?: string;
};

export default function ContentTrackButton({
  active,
  onTrack,
  onClearTrack,
  className,
}: ContentTrackButtonProps) {
  return (
    <Button
      type="button"
      onClick={active ? onClearTrack : onTrack}
      className={cn(
        "cyber-btn inline-flex shrink-0 items-center justify-center gap-1 py-1 text-lg font-semibold",
        className,
      )}
    >
      <Icon
        icon={active ? "CircleX" : "Focus"}
        className="size-lg stroke-current"
      />
      {active ? "Cancel" : "Tracking"}
    </Button>
  );
}
