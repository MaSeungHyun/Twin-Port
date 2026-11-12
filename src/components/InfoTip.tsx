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
              className="size-[1em] stroke-dt-text-2 transition-colors group-hover:stroke-dt-point group-focus-visible:stroke-dt-point"
            />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-[1000] max-w-72 rounded-lg bg-dt-bg/92 px-3 py-2 text-[12px] leading-snug font-normal text-dt-text shadow-[inset_0_0_0_2px_#ffffff1a]"
          >
            {text}
            <TooltipPrimitive.Arrow className="fill-dt-bg" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
