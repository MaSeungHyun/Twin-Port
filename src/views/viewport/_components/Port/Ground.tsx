import groundUrl from "@/assets/model/BUSAN.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  extractGroundBlocks,
  listObjectNames,
} from "@/domain/extractGroundBlocks";
import { shipsFromPlacements } from "@/domain/extractShipCubes";
import {
  applyGlbViewCamera,
  extractGlbViewCamera,
} from "@/domain/extractGlbCamera";
import { bakeLandMask } from "@/domain/bakeLandMask";
import { enableGroundWaveResponse } from "@/domain/groundWaveMaterial";
import { bindLandTexture, resetLandTexture } from "@/domain/waterSim";
import {
  GROUND_POSITION,
  GROUND_ROTATION,
  GROUND_SCALE,
} from "@/constants/ground";
import { OCEAN_SIM_EXTENT, OCEAN_SIM_SIZE } from "@/constants/ocean";
import { getOccupancySurfaceMaterial } from "@/domain/occupancyLook/occupancySurfaceMaterial";
import { warmupOccupancyPrograms } from "@/domain/occupancyLook/warmupOccupancyPrograms";
import {
  collectQuayHoverTargets,
  findQuayCraneRoot,
  getPortHover,
  portHoverOut,
  portHoverOver,
  quayTargetMatches,
  subscribePortHover,
  writeQuayOutlineMatrix,
} from "@/domain/hoverOutline";
import { useYardStore } from "@/stores/yard";
import { useOccupancyStore } from "@/stores/occupancy";
import { useGLTF } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  InstancedMesh,
  Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Vector3Tuple,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import HoverOutlineMesh from "./HoverOutlineMesh";

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

function isCraneMesh(mesh: Mesh) {
  return namesOf(mesh).some((name) => /crane/i.test(name));
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
    if (child.name.endsWith("-occupancy")) return;
    if (isCraneMesh(child)) return;
    if (isGroundMesh(child)) ground.push(child);
    else others.push(child);
  });
  return { ground, others };
}

function rememberOriginalVisible(mesh: Mesh) {
  if (mesh.userData.occupancyOriginalVisible !== undefined) return;
  mesh.userData.occupancyOriginalVisible = mesh.visible;
}

function attachOccupancyClones(
  ground: Mesh[],
  occupancyMaterial: MeshStandardMaterial,
) {
  const clones: Mesh[] = [];
  for (const mesh of ground) {
    const clone = new Mesh(mesh.geometry, occupancyMaterial);
    clone.name = `${mesh.name || "ground"}-occupancy`;
    clone.visible = false;
    clone.castShadow = mesh.castShadow;
    clone.receiveShadow = mesh.receiveShadow;
    clone.frustumCulled = mesh.frustumCulled;
    clone.matrixAutoUpdate = mesh.matrixAutoUpdate;
    clone.position.copy(mesh.position);
    clone.quaternion.copy(mesh.quaternion);
    clone.scale.copy(mesh.scale);
    if (!mesh.matrixAutoUpdate) clone.matrix.copy(mesh.matrix);
    mesh.parent?.add(clone);
    clones.push(clone);
  }
  return clones;
}

function applyOccupancyGroundLook(
  cache: OccupancyMeshCache,
  clones: Mesh[],
  enabled: boolean,
) {
  for (const mesh of cache.ground) {
    rememberOriginalVisible(mesh);
    mesh.visible = enabled ? false : mesh.userData.occupancyOriginalVisible;
  }
  for (const clone of clones) {
    clone.visible = enabled;
  }
  for (const mesh of cache.others) {
    rememberOriginalVisible(mesh);
    mesh.visible = enabled ? false : mesh.userData.occupancyOriginalVisible;
  }
}

type GroundProps = {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
};

export default function Ground({
  position = GROUND_POSITION,
  rotation = GROUND_ROTATION,
  scale = [GROUND_SCALE, GROUND_SCALE, GROUND_SCALE],
}: GroundProps) {
  const setModelBlocks = useYardStore((s) => s.setModelBlocks);
  const setModelShips = useYardStore((s) => s.setModelShips);
  const resetBlocks = useYardStore((s) => s.resetBlocks);
  const gl = useThree((state) => state.gl);
  const threeScene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | OrbitControlsImpl
    | undefined;
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

  const occupancyMeshes = useMemo(() => collectOccupancyMeshes(model), [model]);

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
    model.updateMatrixWorld(true);
    const view = extractGlbViewCamera(model);
    if (!view) return;
    applyGlbViewCamera(camera, view, controls ?? null);
  }, [model, position, rotation, scale, camera, controls]);

  useLayoutEffect(() => {
    const clones = attachOccupancyClones(
      occupancyMeshes.ground,
      occupancyMaterial,
    );

    const apply = (look: boolean) => {
      applyOccupancyGroundLook(occupancyMeshes, clones, look);
    };

    if (!occupancyWarmed.current) {
      apply(true);
      warmupOccupancyPrograms(gl, threeScene, camera);
      gl.compile(threeScene, camera);
      occupancyWarmed.current = true;
    }
    apply(useOccupancyStore.getState().occupancyLook);

    const unsub = useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(state.occupancyLook);
    });

    return () => {
      unsub();
      for (const clone of clones) {
        clone.removeFromParent();
      }
    };
  }, [occupancyMeshes, occupancyMaterial, gl, threeScene, camera]);

  return (
    <>
      <primitive
        object={model}
        position={position}
        rotation={rotation}
        scale={scale}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          const root = findQuayCraneRoot(event.object);
          if (!root) return;
          const id =
            event.instanceId != null &&
            (root as InstancedMesh).isInstancedMesh
              ? `${root.uuid}:${event.instanceId}`
              : root.uuid;
          portHoverOver(event, "quayCrane", id);
        }}
        onPointerOut={(event: ThreeEvent<PointerEvent>) => {
          const root = findQuayCraneRoot(event.object);
          if (!root) return;
          const id =
            event.instanceId != null &&
            (root as InstancedMesh).isInstancedMesh
              ? `${root.uuid}:${event.instanceId}`
              : root.uuid;
          portHoverOut(event, "quayCrane", id);
        }}
      />
      <QuayCraneHoverOutlines model={model} />
    </>
  );
}

function QuayCraneHoverOutlines({ model }: { model: Object3D }) {
  const targets = useMemo(() => collectQuayHoverTargets(model), [model]);
  const outlineRefs = useRef<(Mesh | null)[]>([]);

  useLayoutEffect(() => {
    const apply = () => {
      const hover = getPortHover();
      const hoverId = hover?.kind === "quayCrane" ? hover.id : null;
      targets.forEach((target, index) => {
        const outline = outlineRefs.current[index];
        if (!outline) return;
        const show = hoverId != null && quayTargetMatches(target, hoverId);
        outline.visible = show;
        if (show) writeQuayOutlineMatrix(target, outline);
      });
    };

    apply();
    return subscribePortHover(apply);
  }, [targets]);

  return (
    <>
      {targets.map((target, index) => (
        <HoverOutlineMesh
          key={`${target.rootId}-${index}`}
          geometry={target.geometry}
          meshRef={(node) => {
            outlineRefs.current[index] = node;
          }}
        />
      ))}
    </>
  );
}

useGLTF.preload(groundUrl);
