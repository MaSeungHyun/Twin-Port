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
      className="flex cursor-pointer items-center gap-2 select-none"
    >
      <CheckboxPrimitive.Root
        id={id}
        data-slot="checkbox"
        className={cn(
          "peer flex size-4 shrink-0 items-center justify-center rounded-xs border border-white/30 bg-transparent",
          "outline-none transition-colors",
          "hover:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
          "data-[state=checked]:border-primary/50 data-[state=checked]:bg-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-white"
        >
          <Icon icon="Check" className="size-3 stroke-3 stroke-white" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? <span className="text-sm text-white">{label}</span> : null}
    </label>
  );
}
