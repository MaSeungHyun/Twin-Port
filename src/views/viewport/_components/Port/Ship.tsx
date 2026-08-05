import shipUrl from "@/assets/model/ship.glb";
import { enableGlbShadows } from "@/domain/glb";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  type InstancedMesh,
  Matrix4,
  type Mesh,
  type Material,
  Object3D,
  type BufferGeometry,
} from "three";

export type ShipInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

type ShipPart = {
  geometry: BufferGeometry;
  material: Material | Material[];
  localMatrix: Matrix4;
};

type ShipProps = {
  instances: ShipInstance[];
};

export default function Ship({ instances }: ShipProps) {
  const { scene } = useGLTF(shipUrl);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  const parts = useMemo<ShipPart[]>(() => {
    scene.updateMatrixWorld(true);
    enableGlbShadows(scene);
    const collected: ShipPart[] = [];

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

useGLTF.preload(shipUrl);
