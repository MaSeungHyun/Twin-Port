import type { CraneOperationalTone } from "@/domain/portTwinMock";
import { cn } from "@/utils/style";

type OperationalStatusIndicatorProps = {
  label: string;
  tone: CraneOperationalTone;
  className?: string;
};

export default function OperationalStatusIndicator({
  label,
  tone,
  className,
}: OperationalStatusIndicatorProps) {
  return (
    <div
      className={cn("flex items-center gap-sm", className)}
      role="status"
      aria-label={label}
    >
      <CraneStatusDot tone={tone} />
      <span className="cyber-status-label">{label}</span>
    </div>
  );
}

export function CraneStatusDot({
  tone,
  label,
  className,
}: {
  tone: CraneOperationalTone;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(
        "cyber-status-dot shrink-0",
        `cyber-status-dot--${tone}`,
        className,
      )}
    />
  );
}
