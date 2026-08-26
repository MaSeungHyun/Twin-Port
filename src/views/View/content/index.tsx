import { useState } from "react";
import BlockContentAccordion from "./_components/block/BlockContentAccordion";
import ContainerContentAccordion from "./_components/container/ContainerContentAccordion";

/**
 * 3D Scene 위 2D UI 레이어.
 * - 루트는 pointer-events-none 으로 캔버스(OrbitControls/picking)를 통과
 * - 실제 클릭되는 패널만 pointer-events-auto
 * - 접으면 헤더 높이만, 열리면 Content 내부 스크롤
 */
export default function Contents() {
  const [containersOpen, setContainersOpen] = useState(true);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <aside className="pointer-events-auto absolute top-0 left-0 flex h-full w-72 flex-col overflow-hidden px-xs py-xs">
        <div className="flex h-full min-h-0 flex-col gap-xs overflow-hidden">
          <BlockContentAccordion siblingOpen={containersOpen} />
          <ContainerContentAccordion onOpenChange={setContainersOpen} />
        </div>
      </aside>
    </div>
  );
}
