import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import { DropdownMenu } from "@/components/DropdownMenu";
import Icon from "@/components/Icon";
import { useObjectStore } from "@/stores/object";

export default function ViewOption() {
  const terrainVisible = useObjectStore((s) => s.terrainVisible);
  const setTerrainVisible = useObjectStore((s) => s.setTerrainVisible);
  const containerVisible = useObjectStore((s) => s.containerVisible);
  const setContainerVisible = useObjectStore((s) => s.setContainerVisible);
  const heatmapVisible = useObjectStore((s) => s.heatmapVisible);
  const setHeatmapVisible = useObjectStore((s) => s.setHeatmapVisible);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Icon icon="Eye" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <div className="flex flex-col gap-2 px-1 py-1 text-sm text-white">
          <Checkbox
            id="view-option-terrain"
            label="Terrain"
            checked={terrainVisible}
            onCheckedChange={(checked) => setTerrainVisible(checked === true)}
          />
          <Checkbox
            id="view-option-container"
            label="Container"
            checked={containerVisible}
            onCheckedChange={(checked) => setContainerVisible(checked === true)}
          />
          <Checkbox
            id="view-option-heatmap"
            label="HeatMap"
            checked={heatmapVisible}
            onCheckedChange={(checked) => setHeatmapVisible(checked === true)}
          />
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
