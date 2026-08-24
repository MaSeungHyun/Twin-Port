import terrainUrl from "@/assets/model/busan_geometry.glb";
import {
  TERRAIN_POSITION,
  TERRAIN_ROTATION,
  TERRAIN_SCALE,
} from "@/constants/terrain";
import { enableGlbShadows } from "@/domain/glb";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Mesh, type Object3D } from "three";

function prepareTerrain(root: Object3D, maxAnisotropy: number) {
  root.traverse((child) => {
    // Blender GIS 헬퍼 — 메시는 EXPORT에 이미 베이크됨. 스케일 8560 빈 노드는 숨김.
    if (child.name === "GOOGLE_SAT_WM") {
      child.visible = false;
      return;
    }
    if (!(child instanceof Mesh)) return;

    child.frustumCulled = false;
    const source = child.material;
    const list = Array.isArray(source) ? source : [source];
    for (const mat of list) {
      if (!mat || !("map" in mat) || !mat.map) continue;
      mat.map.anisotropy = maxAnisotropy;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
    }
  });
  enableGlbShadows(root, { castShadow: false, receiveShadow: true });
}

export default function Terrain({ visible = true }: { visible?: boolean }) {
  const maxAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );
  const { scene } = useGLTF(terrainUrl);

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    prepareTerrain(cloned, maxAnisotropy);
    return cloned;
  }, [scene, maxAnisotropy]);

  return (
    <primitive
      object={model}
      position={TERRAIN_POSITION}
      rotation={TERRAIN_ROTATION}
      scale={TERRAIN_SCALE}
      visible={visible}
    />
  );
}

useGLTF.preload(terrainUrl);
