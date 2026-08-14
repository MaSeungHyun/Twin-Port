import { useYardStore } from "@/stores/yard";
import {
  getBlockFootprintCenter,
  getBlockFootprintSize,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from "three";
import BlockFloorLabel from "./BlockFloorLabel";
import { BLOCK_MARK, occupancyColor } from "./constants";

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _axis = new Vector3(0, 1, 0);
const _matrix = new Matrix4();

function writeInstance(
  mesh: InstancedMesh,
  index: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  yaw: number,
) {
  _pos.set(position[0], position[1], position[2]);
  _quat.setFromAxisAngle(_axis, yaw);
  _scale.set(scale[0], scale[1], scale[2]);
  mesh.setMatrixAt(index, _matrix.compose(_pos, _quat, _scale));
}

/** 바닥 색 + 외곽 라인 — 블록 yaw·크기에 맞춤 */
export default function BlockMarks({
  occupancyByCode,
}: {
  occupancyByCode: Record<string, BlockOccupancy>;
}) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const floorRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const floorMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const mesh = floorRef.current;
    if (!mesh) return;

    const color = new Color();

    blocks.forEach((block, index) => {
      const center = getBlockFootprintCenter(block);
      const { width, depth } = getBlockFootprintSize(block);
      writeInstance(
        mesh,
        index,
        [
          center[0],
          deckY + block.origin[1] + BLOCK_MARK.floorHeight / 2 + 0.004,
          center[2],
        ],
        [width, BLOCK_MARK.floorHeight, depth],
        block.yaw ?? 0,
      );

      const occupancy = occupancyByCode[block.code];
      color.set(occupancyColor(occupancy?.ratio ?? 0));
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = blocks.length;
  }, [occupancyByCode, blocks, deckY]);

  return (
    <group name="block-marks">
      <instancedMesh
        ref={floorRef}
        args={[geometry, floorMaterial, Math.max(blocks.length, 1)]}
        frustumCulled={false}
        renderOrder={15}
        receiveShadow
        raycast={() => null}
      />
      {blocks.map((block) => {
        const occupancy = occupancyByCode[block.code];
        if (!occupancy) return null;
        return (
          <BlockFloorLabel
            key={`label-${block.code}`}
            block={block}
            occupancy={occupancy}
          />
        );
      })}
    </group>
  );
}
