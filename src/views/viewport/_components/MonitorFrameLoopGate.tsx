import { useViewportStore } from "@/stores/viewport";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/** monitorMode 구독을 Canvas 내부로 — Scene(R3FCanvas) 리렌더 없이 frameloop만 전환 */
export default function MonitorFrameLoopGate() {
  const setFrameloop = useThree((s) => s.setFrameloop);

  useEffect(() => {
    const apply = (monitorMode: boolean) => {
      setFrameloop(monitorMode ? "never" : "always");
    };

    apply(useViewportStore.getState().monitorMode);

    return useViewportStore.subscribe((state, prev) => {
      if (state.monitorMode === prev.monitorMode) return;
      apply(state.monitorMode);
    });
  }, [setFrameloop]);

  return null;
}
