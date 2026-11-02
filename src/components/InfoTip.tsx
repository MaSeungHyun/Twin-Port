import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import { Tooltip as TooltipPrimitive } from "radix-ui";

type InfoTipProps = {
  /** 호버 시 보여줄 설명 */
  text: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/** 타이틀 옆 인포 아이콘 — 호버(포커스) 시 설명 툴팁 */
export default function InfoTip({ text, className, side = "top" }: InfoTipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={text}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "group inline-flex shrink-0 items-center justify-center align-middle outline-none",
              className,
            )}
          >
            <Icon
              icon="Info"
              className="size-[1em] stroke-text-secondary transition-colors group-hover:stroke-primary group-focus-visible:stroke-primary"
            />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-1000 max-w-72 rounded-md border border-primary/40 bg-foreground/95 px-md py-sm text-md leading-snug font-normal normal-case tracking-normal text-text-primary shadow-lg backdrop-blur-sm"
          >
            {text}
            <TooltipPrimitive.Arrow className="fill-primary/40" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
