import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

type ChipProps = ComponentProps<"button"> & {
  pressed?: boolean;
};

/** 필터 칩. 높이 28, 모서리 6 */
export default function Chip({ pressed = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2 text-[12px]",
        pressed ? "dt-active" : "bg-white/4 text-dt-text-2 hover:bg-white/6",
        className,
      )}
      {...props}
    />
  );
}
