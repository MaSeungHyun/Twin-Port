import {
  DEPTH_BREADCRUMB_SEPARATOR,
  DEPTH_BREADCRUMB_TRAILING,
} from "@/constants/areaCam";
import { useCameraDepthStore } from "@/stores/cameraDepth";

/** [depth] 화면 하단 가운데 현재 depth 경로 (예: "A >", 추후 "A > 크레인 12"). 최상위에서는 숨김 */
export default function DepthBreadcrumb() {
  const stack = useCameraDepthStore((s) => s.stack);
  if (!stack.length) return null;
  return (
    <div className="pointer-events-none absolute bottom-[32px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-sm rounded-lg border-2 border-white/40 bg-[#00000080] px-md py-xs shadow-lg select-none">
      <span className="text-md tracking-wide text-text-primary">
        {stack.map((e) => e.label).join(` ${DEPTH_BREADCRUMB_SEPARATOR} `)}
        {DEPTH_BREADCRUMB_TRAILING ? ` ${DEPTH_BREADCRUMB_SEPARATOR}` : ""}
      </span>
      <span className="text-sm font-light text-white/50">ESC</span>
    </div>
  );
}
