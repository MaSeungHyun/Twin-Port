import { cn } from "@/utils/style";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 border font-medium whitespace-nowrap text-white transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/25 bg-white/10",
        primary: "border-primary/50 bg-primary/20",
        success: "border-success/50 bg-success/15",
        warning: "border-warning/50 bg-warning/15",
        danger: "border-danger/50 bg-danger/15",
        outline: "border-white/20 bg-transparent text-white/80",
      },
      fill: {
        true: "text-white",
        false: "",
      },
      shape: {
        circle: "rounded-full",
        rect: "rounded-sm",
      },
      size: {
        sm: "h-5 px-1.5 text-xs",
        md: "h-6 px-xs text-sm",
        lg: "h-7 px-sm text-md",
      },
    },
    compoundVariants: [
      { variant: "default", fill: true, class: "border-white/80 bg-white/80 text-black" },
      { variant: "primary", fill: true, class: "border-primary bg-primary text-white" },
      { variant: "success", fill: true, class: "border-success bg-success text-text-primary" },
      { variant: "warning", fill: true, class: "border-warning bg-warning text-text-primary" },
      { variant: "danger", fill: true, class: "border-danger bg-danger text-text-primary" },
      {
        variant: "outline",
        fill: true,
        class: "border-transparent bg-white/80 text-black",
      },
      // 완벽한 원: 가로=세로, 좌우 패딩 제거
      { shape: "circle", size: "sm", class: "size-5 px-0" },
      { shape: "circle", size: "md", class: "size-6 px-0" },
      { shape: "circle", size: "lg", class: "size-7 px-0" },
    ],
    defaultVariants: {
      variant: "default",
      fill: false,
      shape: "rect",
      size: "md",
    },
  },
);

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

export default function Badge({
  className,
  variant,
  fill,
  shape,
  size,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  const content =
    typeof children === "number" && children > 9 ? "9+" : children;

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, fill, shape, size }), className)}
      {...props}
    >
      {content}
    </Comp>
  );
}
