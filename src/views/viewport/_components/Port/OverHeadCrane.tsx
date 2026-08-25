import overheadCraneUrl from "@/assets/model/overhead_crane.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  hoveredIndexOf,
  instanceHoverId,
  portHoverOut,
  portHoverOver,
  subscribePortHover,
} from "@/domain/hoverOutline";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  Object3D,
} from "three";
import HoverOutlineMesh from "./HoverOutlineMesh";
import {
  createBlockCenterCraneInstances,
  type OverHeadCraneInstance,
} from "./overheadCraneInstances";
import { useYardStore } from "@/stores/yard";

type CranePart = {
  geometry: BufferGeometry;
  material: Material | Material[];
  localMatrix: Matrix4;
};

type OverHeadCraneProps = {
  instances?: OverHeadCraneInstance[];
};

export default function OverHeadCrane({ instances }: OverHeadCraneProps) {
  const blocks = useYardStore((s) => s.blocks);
  const deckY = useYardStore((s) => s.deckY);
  const resolvedInstances = useMemo(
    () => instances ?? createBlockCenterCraneInstances(blocks, deckY),
    [instances, blocks, deckY],
  );
  const { scene } = useGLTF(overheadCraneUrl);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const outlineRefs = useRef<(Mesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);

  const parts = useMemo<CranePart[]>(() => {
    scene.updateMatrixWorld(true);
    enableGlbShadows(scene);
    const collected: CranePart[] = [];

    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      collected.push({
        geometry: mesh.geometry,
        material: mesh.material,
        localMatrix: mesh.matrixWorld.clone(),
      });
    });

    return collected;
  }, [scene]);

  const applyHoverOutline = useCallback(() => {
    const hoverIndex = hoveredIndexOf("overheadCrane");
    parts.forEach((_, partIndex) => {
      const outline = outlineRefs.current[partIndex];
      const instanced = meshRefs.current[partIndex];
      if (!outline) return;
      if (hoverIndex < 0 || !instanced) {
        outline.visible = false;
        return;
      }
      instanced.getMatrixAt(hoverIndex, outline.matrix);
      outline.matrixWorldNeedsUpdate = true;
      outline.visible = true;
    });
  }, [parts]);

  const writeMatrices = useCallback(
    (elapsed: number) => {
      parts.forEach((part, partIndex) => {
        const instanced = meshRefs.current[partIndex];
        if (!instanced) return;

        resolvedInstances.forEach((instance, index) => {
          const t = elapsed * instance.speed + instance.phase;
          const u = (Math.sin(t) + 1) / 2;
          const [sx, sy, sz] = instance.start;
          const [ex, ey, ez] = instance.end;

          dummy.position.set(
            sx + (ex - sx) * u,
            sy + (ey - sy) * u,
            sz + (ez - sz) * u,
          );
          dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));

          const scale = instance.scale ?? 1;
          if (typeof scale === "number") {
            dummy.scale.setScalar(scale);
          } else {
            dummy.scale.set(...scale);
          }

          dummy.updateMatrix();
          matrix.multiplyMatrices(dummy.matrix, part.localMatrix);
          instanced.setMatrixAt(index, matrix);
        });

        instanced.count = resolvedInstances.length;
        instanced.instanceMatrix.needsUpdate = true;
      });

      applyHoverOutline();
    },
    [applyHoverOutline, dummy, matrix, parts, resolvedInstances],
  );

  useLayoutEffect(() => {
    writeMatrices(0);
  }, [writeMatrices]);

  useLayoutEffect(
    () => subscribePortHover(applyHoverOutline),
    [applyHoverOutline],
  );

  useFrame(({ clock }) => {
    writeMatrices(clock.elapsedTime);
  });

  if (resolvedInstances.length === 0) return null;

  return (
    <group>
      {parts.map((part, index) => (
        <group key={index}>
          <instancedMesh
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
            args={[part.geometry, part.material, resolvedInstances.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
            onPointerOver={(event) =>
              portHoverOver(event, "overheadCrane", instanceHoverId(event))
            }
            onPointerOut={(event) =>
              portHoverOut(event, "overheadCrane", instanceHoverId(event))
            }
          />
          <HoverOutlineMesh
            geometry={part.geometry}
            meshRef={(node) => {
              outlineRefs.current[index] = node;
            }}
          />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(overheadCraneUrl);
