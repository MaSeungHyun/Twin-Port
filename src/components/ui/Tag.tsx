import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

const TONE = {
  danger: "bg-dt-danger/8 text-[#FF8A8B] shadow-[inset_0_0_0_1px_#F0484A73]",
  warning: "bg-dt-warn/8 text-[#FFC966] shadow-[inset_0_0_0_1px_#FFB02073]",
  ok: "bg-dt-ok/8 text-[#6FE8C0] shadow-[inset_0_0_0_1px_#14D99B73]",
  info: "bg-dt-info/8 text-[#8CC4FF] shadow-[inset_0_0_0_1px_#3D9BFF73]",
  point: "dt-active",
  neutral: "bg-white/8 text-dt-text-2",
} as const;

type TagProps = ComponentProps<"span"> & {
  tone?: keyof typeof TONE;
};

/** 상태 태그. 고장/주의/복구/정보 */
export default function Tag({ tone = "neutral", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold whitespace-nowrap",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
