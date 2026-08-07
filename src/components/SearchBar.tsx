import Icon from "@/components/Icon";
import Input from "@/components/Input";
import { cn } from "@/utils/style";
import type { ComponentProps } from "react";

type SearchBarProps = Omit<ComponentProps<"input">, "size" | "type"> & {
  size?: "sm" | "md" | "lg";
  containerClassName?: string;
};

const ICON_SIZE = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

const ICON_PAD = {
  sm: "pl-8",
  md: "pl-9",
  lg: "pl-10",
} as const;

const ICON_POS = {
  sm: "left-2.5",
  md: "left-3",
  lg: "left-3.5",
} as const;

export default function SearchBar({
  className,
  containerClassName,
  size = "md",
  ...props
}: SearchBarProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Icon
        icon="Search"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 stroke-white z-2",
          ICON_POS[size],
          ICON_SIZE[size],
        )}
      />
      <Input
        type="search"
        size={size}
        className={cn(
          ICON_PAD[size],
          "pr-1",
          // type=search 네이티브 X는 color로 안 바뀜 → filter로 재색
          "[&::-webkit-search-cancel-button]:cursor-pointer",
          "[&::-webkit-search-cancel-button]:brightness-0",
          "[&::-webkit-search-cancel-button]:invert",
          "[&::-webkit-search-cancel-button]:opacity-55",
          "[&::-webkit-search-cancel-button]:hover:opacity-90",
          "[&::-webkit-search-cancel-button]:px-1",
          className,
        )}
        {...props}
      />
    </div>
  );
}
