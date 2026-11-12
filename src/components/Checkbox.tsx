import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root> & {
  label?: string;
};

export default function Checkbox({
  className,
  label,
  id,
  ...props
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-xs select-none"
    >
      <CheckboxPrimitive.Root
        id={id}
        data-slot="checkbox"
        className={cn(
          "peer flex size-4 shrink-0 items-center justify-center rounded bg-transparent shadow-[inset_0_0_0_2px_rgba(255,255,255,0.28)]",
          "outline-none transition-colors",
          "hover:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)]",
          "focus-visible:ring-2 focus-visible:ring-dt-point/40",
          "data-[state=checked]:bg-dt-point data-[state=checked]:shadow-none",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-white"
        >
          <Icon icon="Check" className="size-3 stroke-[2.5] stroke-[#0A1219]" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? <span className="text-[14px] font-normal text-dt-text">{label}</span> : null}
    </label>
  );
}
