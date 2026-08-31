import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useScrollEdgeFade(length: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setEdge({
      top: el.scrollTop > 4,
      bottom: maxScroll > 4 && el.scrollTop < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    return () => ro.disconnect();
  }, [update, length]);

  return { scrollRef, edge, onScroll: update };
}
