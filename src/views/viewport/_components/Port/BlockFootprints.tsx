import { BLOCKS } from "@/constants/block";
import { DECK_Y } from "@/constants/container";
import { CONTAINER_YARD_OFFSET } from "@/domain/container";
import { getBlockOuterFrameSegments } from "@/domain/blockFootprint";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Matrix4,
  MeshStandardMaterial,
  type InstancedMesh,
} from "three";

const BORDER_THICKNESS = 0.32;
const BORDER_OUTSET = 0.32;
const BORDER_HEIGHT = 0.05;
const BORDER_Y = DECK_Y + BORDER_HEIGHT / 2 + 0.02;

export default function BlockFootprints({
  visible = true,
}: {
  visible?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);

  const segments = useMemo(
    () =>
      BLOCKS.flatMap((block) =>
        getBlockOuterFrameSegments(
          block.origin,
          BORDER_Y,
          BORDER_THICKNESS,
          BORDER_HEIGHT,
          BORDER_OUTSET,
        ),
      ),
    [],
  );

  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#cacaca",
        emissive: "#1a4a7a",
        // emissiveIntensity: 0.35,
        roughness: 0.85,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const mesh = ref.current;
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

  return (
    <group position={CONTAINER_YARD_OFFSET} visible={visible}>
      <instancedMesh
        ref={ref}
        args={[geometry, material, segments.length]}
        frustumCulled={false}
        renderOrder={20}
        receiveShadow
        raycast={() => null}
      />
    </group>
  );
}
