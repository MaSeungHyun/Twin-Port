import { forwardRef, type ComponentProps, type ReactNode } from "react";
import type { icons } from "lucide-react";

import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";

type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** lucide 아이콘 이름 */
  icon: keyof typeof icons;
  /** 접근성 라벨 + 툴팁(title) */
  label?: string;
  /** 선택/켜짐 상태 → aria-pressed */
  active?: boolean;
  /** 아이콘 추가 클래스 (크기 등) */
  iconClassName?: string;
  /** 뱃지 등 아이콘 옆 추가 요소 */
  children?: ReactNode;
};

/**
 * 공용 아이콘 토글 버튼 (CODE_GUIDE.md "공용 IconButton" 참고)
 * - 선택: aria-pressed / 드롭다운 열림: data-[state=open]
 * - 아이콘 상태색: group-* 접두사
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon, label, active, iconClassName, className, children, ...props },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn(
          "group flex items-center justify-center border border-transparent",
          "hover:bg-cyber/10",
          "aria-pressed:border-cyber/40 aria-pressed:bg-cyber/15 aria-pressed:hover:bg-primary/20",
          "aria-pressed:shadow-[0_0_12px_rgba(0,232,255,0.25)]",
          "data-[state=open]:border-cyber/40 data-[state=open]:bg-cyber/15",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
          className,
        )}
        {...props}
      >
        <Icon
          icon={icon}
          className={cn(
            "stroke-icon-default group-hover:stroke-icon-hover group-hover:stroke-2",
            "group-aria-pressed:stroke-icon-active group-data-[state=open]:stroke-icon-active",
            "group-disabled:stroke-icon-disabled",
            iconClassName,
          )}
        />
        {children}
      </Button>
    );
  },
);

export default IconButton;
