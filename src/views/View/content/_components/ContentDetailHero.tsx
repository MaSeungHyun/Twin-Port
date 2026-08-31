import { cn } from "@/utils/style";

/** 모든 썸네일 공통 정사각형 크기 */
export const CONTENT_THUMBNAIL_SIZE = "size-48";

type ContentDetailHeroProps = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  /** block: 패널 너비 기준 정사각형 / fixed: 고정 정사각형 */
  layout?: "block" | "fixed";
  titleClassName?: string;
  className?: string;
};

export default function ContentDetailHero({
  src,
  alt,
  title,
  subtitle,
  layout = "block",
  titleClassName,
  className,
}: ContentDetailHeroProps) {
  return (
    <div className={cn("relative z-1 flex flex-col", className)}>
      <div
        className={cn(
          "cyber-image-stage shrink-0 overflow-hidden",
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
        <div className={cn(layout === "block" ? "px-xl py-sm" : "pt-xs")}>
          {title ? (
            <p className={cn(titleClassName ?? "cyber-heading text-lg", "truncate")}>
              {title}
            </p>
          ) : null}
          {subtitle ? (
            <p className="cyber-subheading mt-0.5 truncate">{subtitle}</p>
          ) : null}
          <div className="cyber-divider mt-sm" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
