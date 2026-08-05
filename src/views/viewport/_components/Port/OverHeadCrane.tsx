import overheadCraneUrl from "@/assets/model/overhead_crane.glb";
import { enableGlbShadows } from "@/domain/glb";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  Object3D,
} from "three";
import {
  createBlockCenterCraneInstances,
  type OverHeadCraneInstance,
} from "./overheadCraneInstances";

type CranePart = {
  geometry: BufferGeometry;
  material: Material | Material[];
  localMatrix: Matrix4;
};

type OverHeadCraneProps = {
  instances?: OverHeadCraneInstance[];
};

export default function OverHeadCrane({
  instances = createBlockCenterCraneInstances(),
}: OverHeadCraneProps) {
  const { scene } = useGLTF(overheadCraneUrl);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

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

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const matrix = new Matrix4();

    parts.forEach((part, partIndex) => {
      const instanced = meshRefs.current[partIndex];
      if (!instanced) return;

      instances.forEach((instance, index) => {
        dummy.position.set(...instance.position);
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

      instanced.count = instances.length;
      instanced.instanceMatrix.needsUpdate = true;
    });
  }, [instances, parts]);

  if (instances.length === 0) return null;

  return (
    <group>
      {parts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(node) => {
            meshRefs.current[index] = node;
          }}
          args={[part.geometry, part.material, instances.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

useGLTF.preload(overheadCraneUrl);
