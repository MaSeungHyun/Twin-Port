import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/utils/style";

export type FrameSize = { width: number; height: number | "fill" | "auto"; lift?: boolean };

type Side = "left" | "right";
type Entry = { id: string; size: FrameSize; node: ReactNode; rank: number };

const maps: Record<Side, Map<string, Entry>> = { left: new Map(), right: new Map() };
const listeners = new Set<() => void>();
let snapshot: { left: Entry | null; right: Entry | null } = { left: null, right: null };
let queued = false;

function pick(map: Map<string, Entry>) {
  let best: Entry | null = null;
  for (const entry of map.values()) {
    if (!best || entry.rank >= best.rank) best = entry;
  }
  return best;
}

function publish() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const next = { left: pick(maps.left), right: pick(maps.right) };
    if (next.left === snapshot.left && next.right === snapshot.right) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

/** 왼쪽·오른쪽 유리 틀에 내용을 올린다. 틀은 그대로 두고 내용만 바꾼다. */
export function FrameSlot({
  side,
  id,
  active = true,
  size,
  rank,
  children,
}: {
  side: Side;
  id: string;
  active?: boolean;
  size: FrameSize;
  rank: number;
  children: ReactNode;
}) {
  const nodeRef = useRef(children);
  const sizeRef = useRef(size);
  const activeRef = useRef(active);
  nodeRef.current = children;
  sizeRef.current = size;
  activeRef.current = active;

  useLayoutEffect(() => {
    return () => {
      if (maps[side].delete(id)) publish();
    };
  }, [side, id]);

  useLayoutEffect(() => {
    if (!active) {
      if (maps[side].delete(id)) publish();
      return;
    }
    maps[side].set(id, { id, size: sizeRef.current, node: nodeRef.current, rank });
    publish();
  });

  return null;
}

function frameStyle(size: FrameSize, auto: number) {
  const lift = size.lift ? " - var(--toast-lift, 0px)" : "";
  const maxHeight = `calc(100dvh - 112px${lift})`;
  if (size.height === "fill") return { width: size.width, height: maxHeight, maxHeight };
  if (size.height === "auto") return { width: size.width, height: auto > 0 ? Math.min(auto, 2000) : undefined, maxHeight };
  return { width: size.width, height: `min(${size.height}px, ${maxHeight})`, maxHeight };
}

function SideFrame({ side }: { side: Side }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const entry = snap[side];
  const [shown, setShown] = useState<Entry | null>(null);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [resize, setResize] = useState(false);
  const [auto, setAuto] = useState(0);
  const latest = useRef(entry);
  const body = useRef<HTMLDivElement>(null);
  latest.current = entry;

  useLayoutEffect(() => {
    if (shown || !entry) return;
    setShown(entry);
    setPhase("in");
  }, [entry, shown]);

  useEffect(() => {
    if (!shown || entry?.id === shown.id) return;
    setPhase("out");
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 80;
    const timer = window.setTimeout(() => {
      setShown(latest.current);
      setPhase(latest.current ? "in" : "out");
    }, ms);
    return () => window.clearTimeout(timer);
  }, [entry?.id, shown]);

  useEffect(() => {
    if (entry && shown && entry.id === shown.id && entry !== shown && phase === "in") setShown(entry);
  }, [entry, shown, phase]);

  useEffect(() => {
    if (shown) setResize(true);
  }, [shown]);

  useLayoutEffect(() => {
    if (shown?.size.height !== "auto" || !body.current) return;
    const next = body.current.scrollHeight;
    if (next !== auto) setAuto(next);
  });

  if (!shown) return null;
  const size = entry?.size ?? shown.size;
  return (
    <aside
      className={cn(
        "hud-glass pointer-events-auto absolute top-6 rounded-[14px]",
        size.height === "auto" ? "overflow-y-auto" : "overflow-hidden",
        side === "left" ? "left-6" : "right-6",
        resize && "transition-[height,width] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
      )}
      style={frameStyle(size, auto)}
    >
      <div
        key={shown.id}
        ref={body}
        className={cn(
          size.height === "auto" ? "" : "h-full",
          phase === "out" || !entry ? "presence-fade-out" : "presence-fade-in",
        )}
      >
        {shown.node}
      </div>
    </aside>
  );
}

export default function PanelFrames() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <SideFrame side="left" />
      <SideFrame side="right" />
    </div>
  );
}
