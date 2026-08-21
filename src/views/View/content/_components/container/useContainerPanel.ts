import { useState } from "react";

const OPEN_VALUE = "containers";

/** 컨테이너 패널 아코디언 열림 */
export function useContainerPanel(onOpenChange?: (open: boolean) => void) {
  const [value, setValue] = useState(OPEN_VALUE);
  const open = value === OPEN_VALUE;

  function setOpen(next: boolean) {
    setValue(next ? OPEN_VALUE : "");
    onOpenChange?.(next);
  }

  return {
    value,
    open,
    onValueChange: (next: string) => setOpen(next === OPEN_VALUE),
    openPanel: () => setOpen(true),
  };
}
