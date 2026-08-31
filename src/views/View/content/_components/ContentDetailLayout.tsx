import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { useContentViewStore } from "@/stores/contentView";
import { cn } from "@/utils/style";
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
  /** 우측 상단 DETAIL — 그래프 패널 토글 */
  onDetailClick?: () => void;
  detailGraphActive?: boolean;
  /** false면 본문 스크롤 비활성 (선박 상세 등) */
  scrollBody?: boolean;
  /** 이미지 아래 이름·구분선 ↔ 디테일 필드 사이 간격 축소 */
  compactHero?: boolean;
  /** block: 패널 너비 정사각형 / fixed: 작은 썸네일 */
  heroLayout?: "block" | "fixed";
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
  onDetailClick,
  detailGraphActive = false,
  scrollBody = true,
  compactHero = false,
  heroLayout = "block",
  children,
}: ContentDetailLayoutProps) {
  const closeDetailGraph = useContentViewStore((s) => s.closeDetailGraph);
  const showTrack = onTrack != null && onClearTrack != null;
  const showDetail = onDetailClick != null;

  function handleTrack() {
    closeDetailGraph();
    onTrack?.();
  }

  return (
    <div className="relative z-1 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "relative w-full shrink-0 px-xl pt-sm",
          scrollBody ? "pb-sm" : compactHero ? "pb-0" : "pb-sm",
        )}
      >
        {showDetail ? (
          <Button
            type="button"
            onClick={onDetailClick}
            aria-label="Toggle detail graph"
            aria-pressed={detailGraphActive}
            className={cn(
              "cyber-btn absolute top-sm right-xl z-2 inline-flex items-center gap-1 px-sm py-1 text-lg font-semibold",
              detailGraphActive && "cyber-detail-btn--active",
            )}
          >
            <Icon icon="Info" className="size-lg stroke-cyber-glow" />
            DETAIL
          </Button>
        ) : null}
        <ContentDetailHero
          src={thumbnail}
          alt={title}
          title={title}
          subtitle={subtitle}
          titleClassName={titleClassName}
          layout={heroLayout}
          compact={compactHero}
          inset
        />
        <Button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="cyber-btn absolute top-sm left-xl z-2 inline-flex items-center gap-1 px-sm py-1 text-lg font-semibold"
        >
          <Icon icon="ArrowLeft" className="size-lg stroke-cyber-glow" />
          Back
        </Button>
      </div>

      <div
        className={cn(
          "relative z-1 min-h-0 w-full flex-1 px-xl",
          scrollBody && "overflow-y-auto overscroll-contain py-sm",
          !scrollBody &&
            cn(
              "overflow-hidden",
              compactHero ? "pt-0 pb-xs" : "py-sm",
            ),
        )}
      >
        {children}
      </div>

      {showTrack ? (
        <div
          className={cn(
            "relative z-2 mt-auto w-full shrink-0 border-t border-cyber/15 bg-background/80 px-xl backdrop-blur-sm",
            scrollBody ? "py-sm" : "py-xs",
          )}
        >
          <ContentTrackButton
            active={tracking}
            onTrack={handleTrack}
            onClearTrack={onClearTrack}
            className="w-full py-2"
          />
        </div>
      ) : null}
    </div>
  );
}

export function DetailFields({
  rows,
}: {
  rows: { label: string; value: string; valueClassName?: string }[];
}) {
  return (
    <dl className="flex w-full flex-col">
      {rows.map(({ label, value, valueClassName }) => (
        <div key={label} className="cyber-stat-row">
          <dt className="cyber-stat-label">
            <span className="cyber-mark" aria-hidden />
            {label}
          </dt>
          <dd className={cn("cyber-stat-value", valueClassName)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
