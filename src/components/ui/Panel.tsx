import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

const ENTER = {
  left: "hud-in-left",
  right: "hud-in-right",
  down: "hud-in-down",
  up: "hud-in-up",
} as const;

type PanelProps = ComponentProps<"section"> & {
  /** 마운트될 때 들어오는 방향 */
  enter?: keyof typeof ENTER;
};

/** 관제 패널. 배경 72%, 안쪽 2px 테두리, 모서리 14px */
export default function Panel({ enter, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "hud-glass rounded-[14px] font-normal text-dt-text",
        enter && ENTER[enter],
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
