import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import { DropdownMenu } from "@/components/DropdownMenu";
import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";

export default function ViewOption() {
  const terrainVisible = useViewportStore((s) => s.terrainVisible);
  const setTerrainVisible = useViewportStore((s) => s.setTerrainVisible);
  const blockStatusVisible = useViewportStore((s) => s.blockStatusVisible);
  const setBlockStatusVisible = useViewportStore(
    (s) => s.setBlockStatusVisible,
  );

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
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
            id="view-option-status"
            label="Status"
            checked={blockStatusVisible}
            onCheckedChange={(checked) =>
              setBlockStatusVisible(checked === true)
            }
          />
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
