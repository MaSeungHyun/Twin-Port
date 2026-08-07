import { BLOCKS } from "@/constants/block";
import {
  getBlockFootprintCenter,
  getBlockOuterFrameSegments,
} from "@/domain/blockFootprint";
import type { BlockOccupancy } from "@/domain/occupancy";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshStandardMaterial,
  type InstancedMesh,
} from "three";
import BlockFloorLabel from "./BlockFloorLabel";
import {
  BLOCK_MARK,
  BORDER_OUTSET,
  BORDER_Y,
  FLOOR_Y,
  occupancyColor,
  PADDED_SIZE,
} from "./constants";

/** 바닥 색 + 외곽 라인 — 동일 PAD로 크기 동기화 */
export default function BlockMarks({
  occupancyByCode,
}: {
  occupancyByCode: Record<string, BlockOccupancy>;
}) {
  const borderRef = useRef<InstancedMesh>(null);
  const floorRef = useRef<InstancedMesh>(null);

  const segments = useMemo(
    () =>
      BLOCKS.flatMap((block) =>
        getBlockOuterFrameSegments(
          block.origin,
          BORDER_Y,
          BLOCK_MARK.borderThickness,
          BLOCK_MARK.borderHeight,
          BORDER_OUTSET,
        ),
      ),
    [],
  );

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const borderMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#cacaca",
        emissive: "#1a4a7a",
        roughness: 0.85,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    [],
  );
  const floorMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const mesh = borderRef.current;
    if (!mesh) return;

    const matrix = new Matrix4();
    segments.forEach((segment, index) => {
      matrix.makeScale(...segment.scale);
      matrix.setPosition(...segment.position);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = segments.length;
  }, [segments]);

  useEffect(() => {
    const mesh = floorRef.current;
    if (!mesh) return;

    const matrix = new Matrix4();
    const color = new Color();

    BLOCKS.forEach((block, index) => {
      const center = getBlockFootprintCenter(block.origin);
      matrix.makeScale(
        PADDED_SIZE.width,
        BLOCK_MARK.floorHeight,
        PADDED_SIZE.depth,
      );
      matrix.setPosition(center[0], FLOOR_Y, center[2]);
      mesh.setMatrixAt(index, matrix);

      const occupancy = occupancyByCode[block.code];
      color.set(occupancyColor(occupancy?.ratio ?? 0));
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = BLOCKS.length;
  }, [occupancyByCode]);

  return (
    <group name="block-marks">
      <instancedMesh
        ref={floorRef}
        args={[geometry, floorMaterial, BLOCKS.length]}
        frustumCulled={false}
        renderOrder={15}
        receiveShadow
        raycast={() => null}
      />
      <instancedMesh
        ref={borderRef}
        args={[geometry, borderMaterial, segments.length]}
        frustumCulled={false}
        renderOrder={20}
        receiveShadow
        raycast={() => null}
      />
      {BLOCKS.map((block) => {
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
