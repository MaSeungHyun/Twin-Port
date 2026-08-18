import groundUrl from "@/assets/model/BUSAN.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  extractGroundBlocks,
  listObjectNames,
} from "@/domain/extractGroundBlocks";
import { shipsFromPlacements } from "@/domain/extractShipCubes";
import { useYardStore } from "@/stores/yard";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import { Material, Mesh, type Object3D, type Vector3Tuple } from "three";

/** opacity만으로는 안 보임 — Three.js는 transparent=true 여야 알파가 블렌딩됨 */
function enableGroundAlpha(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;

    const source = child.material;
    const list = Array.isArray(source) ? source : [source];

    const next = list.map((mat) => {
      if (!(mat instanceof Material)) return mat;

      const hasOpacity =
        "opacity" in mat && typeof mat.opacity === "number" && mat.opacity < 1;
      const hasAlphaMap = "alphaMap" in mat && Boolean(mat.alphaMap);
      if (!mat.transparent && !hasOpacity && !hasAlphaMap) return mat;

      const cloned = mat.clone();
      cloned.transparent = true;
      cloned.depthWrite = false;
      if ("alphaTest" in cloned && cloned.alphaTest < 0.08) {
        cloned.alphaTest = 0.08;
      }
      cloned.needsUpdate = true;
      return cloned;
    });

    child.material = Array.isArray(source) ? next : next[0]!;
  });
}

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
};

export default function Ground({
  position = [0, -3, 0],
  rotation = [0, Math.PI / 2, 0],
  scale = [5, 5, 5],
}: GroundProps) {
  const setModelBlocks = useYardStore((s) => s.setModelBlocks);
  const setModelShips = useYardStore((s) => s.setModelShips);
  const resetBlocks = useYardStore((s) => s.resetBlocks);
  const { scene } = useGLTF(groundUrl);

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);
    enableGlbShadows(cloned);
    enableGroundAlpha(cloned);
    return cloned;
  }, [scene]);

  useLayoutEffect(() => {
    model.position.set(...position);
    model.rotation.set(...rotation);
    model.scale.set(...scale);
    model.updateMatrixWorld(true);
    const blocks = extractGroundBlocks(model);
    const berths = shipsFromPlacements();
    if (berths.length > 0) setModelShips(berths);
    if (blocks.length > 0) {
      if (import.meta.env.DEV) {
        console.info(
          `[Ground] ${blocks.length}개 블록 위치`,
          blocks.map(
            (b) => `${b.code}@${b.origin.map((n) => n.toFixed(1)).join(",")}`,
          ),
        );
      }
      setModelBlocks(blocks);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[Ground] Block / ContainerStack 오브젝트가 없습니다. 노드:",
        listObjectNames(model),
      );
    }
    return () => resetBlocks();
  }, [
    model,
    position,
    rotation,
    scale,
    setModelBlocks,
    setModelShips,
    resetBlocks,
  ]);

  return (
    <primitive
      object={model}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

useGLTF.preload(groundUrl);
