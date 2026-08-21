import Contents from "@/views/View/content";
import { useViewportStore } from "@/stores/viewport";

/**
 * monitorMode 구독을 이 레이어에만 두어 Viewport/Scene 전체 리렌더를 피함.
 * 언마운트 대신 hidden — Contents 재생성 비용을 피함.
 */
export default function ContentsLayer() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const hidden = monitorMode;

  return (
    <div
      className={hidden ? "hidden" : undefined}
      aria-hidden={hidden}
    >
      <Contents />
    </div>
  );
}
