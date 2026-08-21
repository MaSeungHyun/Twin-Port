import groundUrl from "@/assets/model/BUSAN.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  extractGroundBlocks,
  listObjectNames,
} from "@/domain/extractGroundBlocks";
import { shipsFromPlacements } from "@/domain/extractShipCubes";
import { bakeLandMask } from "@/domain/bakeLandMask";
import { enableGroundWaveResponse } from "@/domain/groundWaveMaterial";
import { bindLandTexture, resetLandTexture } from "@/domain/waterSim";
import { OCEAN_SIM_EXTENT, OCEAN_SIM_SIZE } from "@/constants/ocean";
import {
  getOccupancySurfaceMaterial,
  warmupOccupancyPrograms,
} from "@/domain/occupancyLook";
import { useYardStore } from "@/stores/yard";
import { useOccupancyStore } from "@/stores/occupancy";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Vector3Tuple,
} from "three";

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

function namesOf(mesh: Mesh) {
  return [mesh.name, mesh.parent?.name ?? "", mesh.geometry?.name ?? ""];
}

function isGroundMesh(mesh: Mesh) {
  return namesOf(mesh).some(
    (name) => /^ground$/i.test(name) || /cube\.002/i.test(name),
  );
}

type OccupancyMeshCache = {
  ground: Mesh[];
  others: Mesh[];
};

function collectOccupancyMeshes(root: Object3D): OccupancyMeshCache {
  const ground: Mesh[] = [];
  const others: Mesh[] = [];
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (isGroundMesh(child)) ground.push(child);
    else others.push(child);
  });
  return { ground, others };
}

function rememberOriginal(mesh: Mesh) {
  if (mesh.userData.occupancyOriginal) return;
  mesh.userData.occupancyOriginal = {
    material: mesh.material,
    visible: mesh.visible,
  };
}

function applyOccupancyGroundLook(
  cache: OccupancyMeshCache,
  enabled: boolean,
  occupancyMaterial: MeshStandardMaterial,
) {
  if (enabled) {
    for (const mesh of cache.ground) {
      rememberOriginal(mesh);
      mesh.visible = true;
      mesh.material = occupancyMaterial;
    }
    for (const mesh of cache.others) {
      rememberOriginal(mesh);
      mesh.visible = false;
    }
    return;
  }
  for (const mesh of cache.ground) {
    const original = mesh.userData.occupancyOriginal as
      | { material: Mesh["material"]; visible: boolean }
      | undefined;
    if (!original) continue;
    mesh.material = original.material;
    mesh.visible = original.visible;
  }
  for (const mesh of cache.others) {
    const original = mesh.userData.occupancyOriginal as
      | { material: Mesh["material"]; visible: boolean }
      | undefined;
    if (!original) continue;
    mesh.material = original.material;
    mesh.visible = original.visible;
  }
}

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
};

export default function Ground({
  position = [0, -4.1, 0],
  rotation = [0, Math.PI / 2, 0],
  scale = [5, 5, 5],
}: GroundProps) {
  const setModelBlocks = useYardStore((s) => s.setModelBlocks);
  const setModelShips = useYardStore((s) => s.setModelShips);
  const resetBlocks = useYardStore((s) => s.resetBlocks);
  const gl = useThree((state) => state.gl);
  const threeScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const occupancyLook = useOccupancyStore((s) => s.occupancyLook);
  const { scene } = useGLTF(groundUrl);

  const occupancyMaterial = useMemo(() => getOccupancySurfaceMaterial(), []);
  const occupancyWarmed = useRef(false);

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);
    enableGlbShadows(cloned);
    enableGroundAlpha(cloned);
    enableGroundWaveResponse(cloned);
    return cloned;
  }, [scene]);

  const occupancyMeshes = useMemo(
    () => collectOccupancyMeshes(model),
    [model],
  );

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
    const land = bakeLandMask(gl, model, OCEAN_SIM_SIZE, OCEAN_SIM_EXTENT);
    bindLandTexture(land.texture, OCEAN_SIM_SIZE);
    return () => {
      resetBlocks();
      land.dispose();
      resetLandTexture();
    };
  }, [
    model,
    position,
    rotation,
    scale,
    setModelBlocks,
    setModelShips,
    resetBlocks,
    gl,
  ]);

  useLayoutEffect(() => {
    if (!occupancyWarmed.current) {
      applyOccupancyGroundLook(occupancyMeshes, true, occupancyMaterial);
      warmupOccupancyPrograms(gl, threeScene, camera);
      occupancyWarmed.current = true;
      if (!occupancyLook) {
        applyOccupancyGroundLook(occupancyMeshes, false, occupancyMaterial);
      }
    } else {
      applyOccupancyGroundLook(occupancyMeshes, occupancyLook, occupancyMaterial);
    }
  }, [
    occupancyMeshes,
    occupancyLook,
    occupancyMaterial,
    gl,
    threeScene,
    camera,
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
