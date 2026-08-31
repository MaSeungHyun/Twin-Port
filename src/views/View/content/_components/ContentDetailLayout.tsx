import Button from "@/components/Button";
import Icon from "@/components/Icon";
import type { ReactNode } from "react";
import ContentDetailHero from "./ContentDetailHero";
import ContentTrackButton from "./ContentTrackButton";

type ContentDetailLayoutProps = {
  thumbnail: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  tracking?: boolean;
  onTrack?: () => void;
  onClearTrack?: () => void;
  titleClassName?: string;
  children: ReactNode;
};

export default function ContentDetailLayout({
  thumbnail,
  title,
  subtitle,
  onBack,
  tracking = false,
  onTrack,
  onClearTrack,
  titleClassName,
  children,
}: ContentDetailLayoutProps) {
  const showTrack = onTrack != null && onClearTrack != null;

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative shrink-0">
        <ContentDetailHero
          src={thumbnail}
          alt={title}
          title={title}
          subtitle={subtitle}
          titleClassName={titleClassName}
          layout="block"
        />
        <Button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="cyber-btn absolute top-sm left-xl z-2 inline-flex items-center gap-1 px-sm py-1 text-lg font-semibold"
        >
          <Icon icon="ArrowLeft" className="size-md stroke-cyber-glow" />
          Back
        </Button>
        {showTrack ? (
          <ContentTrackButton
            active={tracking}
            onTrack={onTrack}
            onClearTrack={onClearTrack}
            className="absolute top-sm right-sm z-2 px-sm"
          />
        ) : null}
      </div>
      <div className="relative z-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-xl py-sm">
        {children}
      </div>
    </div>
  );
}

export function DetailFields({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <dl className="flex flex-col">
      {rows.map(({ label, value }) => (
        <div key={label} className="cyber-stat-row">
          <dt className="cyber-stat-label">
            <span className="cyber-mark" aria-hidden />
            {label}
          </dt>
          <dd className="cyber-stat-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
