import { cn } from "@/utils/style";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const inputVariants = cva(
  "w-full rounded-sm border bg-black/45 text-white outline-none transition-colors placeholder:text-white/35 focus:border-primary/50 focus:bg-black/60",
  {
    variants: {
      size: {
        sm: "h-6 px-sm text-lg",
        md: "h-8 px-md text-lg",
        lg: "h-10 px-lg text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type InputProps = Omit<ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>;

export default function Input({ className, size, ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      className={cn(
        inputVariants({ size }),
        "border-white/15 focus:ring-1 focus:ring-primary/50",
        className,
      )}
      {...props}
    />
  );
}
