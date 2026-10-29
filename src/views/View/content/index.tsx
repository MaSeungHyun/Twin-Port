import BlockContent from "./_components/block/BlockContent";
import ContainerContent from "./_components/container/ContainerContent";

/**
 * 3D Scene 위 2D UI 레이어.
 * - 루트는 pointer-events-none 으로 캔버스(OrbitControls/picking)를 통과
 * - 실제 클릭되는 패널만 pointer-events-auto
 * - 접으면 헤더 높이만, 열리면 Content 내부 스크롤
 */
export default function Contents() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <aside className="pointer-events-auto absolute top-0 left-0 flex h-full w-85 flex-col overflow-hidden py-6 pl-10">
        <div className="flex h-full min-h-0 flex-col gap-xs overflow-hidden">
          <BlockContent />
          <ContainerContent />
        </div>
      </aside>
    </div>
  );
}
