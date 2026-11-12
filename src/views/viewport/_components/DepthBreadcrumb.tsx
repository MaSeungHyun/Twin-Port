import {
  DEPTH_BREADCRUMB_SEPARATOR,
} from "@/constants/areaCam";
import { useCameraDepthStore } from "@/stores/cameraDepth";

/** [depth] 화면 하단 가운데 현재 depth 경로 (예: "A >", 추후 "A > 크레인 12"). 최상위에서는 숨김 */
export default function DepthBreadcrumb() {
  const stack = useCameraDepthStore((s) => s.stack);
  if (!stack.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-dt-bg/92 px-3 py-2 shadow-[inset_0_0_0_2px_#ffffff14] select-none">
      <span className="text-[14px] text-dt-text">
        {stack.map((e) => e.label).join(` ${DEPTH_BREADCRUMB_SEPARATOR} `)}
      </span>
      {stack.length < 2 && (
        <span className="text-[12px] font-normal text-dt-text-3">ESC</span>
      )}
    </div>
  );
}
