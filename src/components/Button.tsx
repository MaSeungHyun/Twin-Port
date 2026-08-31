import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button">;

function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex relative cursor-pointer rounded-md px-1 py-1 hover:bg-primary/20 items-center justify-center",
        className,
      )}
      {...props}
    />
  );
}
export default Button;
