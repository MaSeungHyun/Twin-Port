import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 긴 목록은 보이는 행과 위·아래 여분만 그린다.
 * 행 높이가 같다는 전제. 스크롤 컨테이너에 직접 넣는다.
 */
export default function WindowedList<T>({
  items,
  rowHeight,
  overscan = 6,
  className,
  renderRow,
  empty,
}: {
  items: readonly T[];
  rowHeight: number;
  overscan?: number;
  className?: string;
  renderRow: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 24 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
      const visible = Math.ceil(el.clientHeight / rowHeight) + overscan * 2;
      setRange({ start, end: Math.min(items.length, start + visible) });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [items.length, rowHeight, overscan]);

  if (items.length === 0) return <div className={className}>{empty}</div>;

  const slice = items.slice(range.start, range.end);
  return (
    <div ref={ref} className={className}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${range.start * rowHeight}px)` }}>
          {slice.map((item, i) => renderRow(item, range.start + i))}
        </div>
      </div>
    </div>
  );
}
