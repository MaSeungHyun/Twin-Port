import { cn } from "@/utils/style";

/** 모든 썸네일 공통 정사각형 크기 */
export const CONTENT_THUMBNAIL_SIZE = "size-48";

const cyberImageStageClass =
  "relative z-1 shrink-0 overflow-hidden bg-[radial-gradient(ellipse_85%_75%_at_50%_85%,rgba(0,120,200,0.28),transparent_70%)] [mask-image:radial-gradient(ellipse_96%_96%_at_50%_50%,#000_62%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_96%_96%_at_50%_50%,#000_62%,transparent_100%)] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_top,rgba(2,8,18,0.55)_0%,transparent_45%)] after:content-['']";

type ContentDetailHeroProps = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  /** block: 패널 너비 기준 정사각형 / fixed: 고정 정사각형 */
  layout?: "block" | "fixed";
  titleClassName?: string;
  className?: string;
  /** 이미지~정보 구간 간격 축소 */
  compact?: boolean;
  /** true면 가로 패딩은 부모에 맡김 */
  inset?: boolean;
};

export default function ContentDetailHero({
  src,
  alt,
  title,
  subtitle,
  layout = "block",
  titleClassName,
  className,
  compact = false,
  inset = false,
}: ContentDetailHeroProps) {
  return (
    <div className={cn("relative z-1 flex flex-col", className)}>
      <div
        className={cn(
          cyberImageStageClass,
          layout === "block" ? "aspect-square w-full" : CONTENT_THUMBNAIL_SIZE,
        )}
      >
        <img
          src={src}
          alt={alt}
          className="relative z-1 size-full object-contain object-center"
        />
      </div>
      {title || subtitle ? (
        <div
          className={cn(
            layout === "block"
              ? cn(compact ? "pt-0 pb-0" : "py-sm", !inset && "px-xl")
              : "pt-xs",
          )}
        >
          {title ? (
            <p
              className={cn(
                titleClassName ?? "cyber-heading text-lg",
                "truncate",
              )}
            >
              {title}
            </p>
          ) : null}
          {subtitle ? (
            <p className="cyber-subheading mt-0.5 truncate">{subtitle}</p>
          ) : null}
          <div
            className={cn("cyber-divider", compact ? "mt-1" : "mt-sm")}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
