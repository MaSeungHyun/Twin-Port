import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & {
  tone?: "primary" | "secondary";
  size?: "md" | "sm";
};

/** 높이 40(일반)·32(작은), 모서리 8. 캡슐 금지 */
export default function Button({
  tone = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-3 text-[14px] font-medium",
        size === "md" ? "h-10" : "h-8 text-[12px]",
        tone === "primary"
          ? "bg-dt-point text-dt-bg hover:bg-dt-point-bright"
          : "bg-white/4 text-dt-text shadow-[inset_0_0_0_1px_#ffffff1f] hover:bg-white/8",
        className,
      )}
      {...props}
    />
  );
}
