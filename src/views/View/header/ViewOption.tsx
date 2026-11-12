import Icon from "@/components/Icon";
import Checkbox from "@/components/Checkbox";
import { DropdownMenu } from "@/components/DropdownMenu";
import { useObjectStore } from "@/stores/object";

export default function ViewOption() {
  // const terrainVisible = useObjectStore((s) => s.terrainVisible);
  // const setTerrainVisible = useObjectStore((s) => s.setTerrainVisible);
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const setContainerVisible = useObjectStore((s) => s.setContainerVisible);
  const heatmapVisible = useObjectStore((s) => s.heatmapVisible);
  const setHeatmapVisible = useObjectStore((s) => s.setHeatmapVisible);
  const reflectionVisible = useObjectStore((s) => s.reflectionVisible);
  const setReflectionVisible = useObjectStore((s) => s.setReflectionVisible);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] lg:flex data-[state=closed]:bg-white/4 data-[state=closed]:text-dt-text data-[state=closed]:hover:bg-white/8 data-[state=open]:dt-active"
        >
          <Icon icon="Layers" className="size-4 stroke-current" />
          레이어
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content collisionPadding={8} className="max-h-[calc(100dvh-112px)] w-[200px] max-w-[calc(100vw-16px)] overflow-y-auto p-3">
        <div className="flex flex-col gap-2 px-1 py-1 text-[12px] text-dt-text">
          {/* <Checkbox
            id="view-option-terrain"
            label="Terrain"
            checked={terrainVisible}
            onCheckedChange={(checked) => setTerrainVisible(checked === true)}
          /> */}
          <Checkbox
            id="view-option-container"
            label="컨테이너"
            checked={containerVisible}
            onCheckedChange={(checked) => setContainerVisible(checked === true)}
          />
          <Checkbox
            id="view-option-heatmap"
            label="점유율 히트맵"
            checked={heatmapVisible}
            onCheckedChange={(checked) => setHeatmapVisible(checked === true)}
          />
          <Checkbox
            id="view-option-reflection"
            label="수면 반사"
            checked={reflectionVisible}
            onCheckedChange={(checked) => setReflectionVisible(checked === true)}
          />
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
