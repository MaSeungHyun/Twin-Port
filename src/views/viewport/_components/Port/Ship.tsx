import shipUrl from "@/assets/model/ship_empty.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  OCCUPANCY_SHIP_COLOR,
  getOccupancyShipMaterial,
} from "@/domain/occupancyLook";
import { SHIP_TWEEN } from "@/constants/tween";
import { useOccupancyStore } from "@/stores/occupancy";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  type BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
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
  waterway: boolean;
};

const WATERWAY_OCCUPANCY_EMISSIVE = new Color(OCCUPANCY_SHIP_COLOR);
const WATERWAY_OCCUPANCY_EMISSIVE_INTENSITY = 1.15;

function isWaterwayObject(object: Object3D) {
  let node: Object3D | null = object;
  while (node) {
    if (/waterway/i.test(node.name)) return true;
    node = node.parent;
  }
  const mesh = object as Mesh;
  return mesh.isMesh && /waterway/i.test(mesh.geometry?.name ?? "");
}

function clonePartMaterial(source: Material | Material[]) {
  return Array.isArray(source) ? source.map((mat) => mat.clone()) : source.clone();
}

function setWaterwayOccupancyEmissive(
  material: Material | Material[],
  look: boolean,
) {
  const list = Array.isArray(material) ? material : [material];
  for (const mat of list) {
    if (!(mat instanceof MeshStandardMaterial)) continue;
    if (look) {
      mat.emissive.copy(WATERWAY_OCCUPANCY_EMISSIVE);
      mat.emissiveIntensity = WATERWAY_OCCUPANCY_EMISSIVE_INTENSITY;
    } else {
      mat.emissive.set(0, 0, 0);
      mat.emissiveIntensity = 0;
    }
  }
}

function instanceScale(instance: ShipInstance) {
  const scale = instance.scale ?? 1;
  return typeof scale === "number" ? scale : scale[0];
}

/** 선수(+X 로컬) 방향으로 실제로 직진 중인지 */
function isGoingStraight(
  instance: ShipInstance,
  prev: [number, number] | undefined,
  next: [number, number],
) {
  if (instanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2) return false;
  if (!prev) return false;
  const dx = next[0] - prev[0];
  const dz = next[1] - prev[1];
  const moved = Math.hypot(dx, dz);
  if (moved < 0.0004) return false;
  const yaw = instance.rotation?.[1] ?? 0;
  const along = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
  return Math.abs(along) >= moved * 0.75;
}

type ShipProps = {
  /** 정적 인스턴스 (posesRef 없을 때) */
  instances?: ShipInstance[];
  /** 애니메이션용 가변 pose (매 프레임 반영) */
  posesRef?: RefObject<ShipInstance[]>;
};

export default function Ship({ instances, posesRef }: ShipProps) {
  const occupancyMaterial = useMemo(() => getOccupancyShipMaterial(), []);
  const { scene } = useGLTF(shipUrl);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const occupancyRefs = useRef<(InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const lastPos = useRef<( [number, number] | undefined)[]>([]);
  const waterwayOn = useRef<number[]>([]);

  const parts = useMemo<ShipPart[]>(() => {
    scene.updateMatrixWorld(true);
    enableGlbShadows(scene);
    const collected: ShipPart[] = [];

    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const waterway = isWaterwayObject(mesh);
      collected.push({
        geometry: mesh.geometry,
        material: waterway ? clonePartMaterial(mesh.material) : mesh.material,
        localMatrix: mesh.matrixWorld.clone(),
        waterway,
      });
    });

    return collected;
  }, [scene]);

  function writeMatrices(list: ShipInstance[]) {
    if (list.length === 0) return;

    if (waterwayOn.current.length !== list.length) {
      waterwayOn.current = new Array(list.length).fill(0);
      lastPos.current = new Array(list.length);
    }

    list.forEach((instance, index) => {
      const next: [number, number] = [instance.position[0], instance.position[2]];
      waterwayOn.current[index] = isGoingStraight(
        instance,
        lastPos.current[index],
        next,
      )
        ? 1
        : 0;
      lastPos.current[index] = next;
    });

    parts.forEach((part, partIndex) => {
      const instanced = meshRefs.current[partIndex];
      const occupancy = occupancyRefs.current[partIndex];
      if (!instanced && !occupancy) return;

      list.forEach((instance, index) => {
        dummy.position.set(...instance.position);
        dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));

        const scale = instance.scale ?? 1;
        const extra = part.waterway ? waterwayOn.current[index]! : 1;
        if (typeof scale === "number") {
          dummy.scale.setScalar(scale * extra);
        } else {
          dummy.scale.set(scale[0] * extra, scale[1] * extra, scale[2] * extra);
        }

        dummy.updateMatrix();
        matrix.multiplyMatrices(dummy.matrix, part.localMatrix);
        instanced?.setMatrixAt(index, matrix);
        occupancy?.setMatrixAt(index, matrix);
      });

      if (instanced) {
        instanced.count = list.length;
        instanced.instanceMatrix.needsUpdate = true;
      }
      if (occupancy) {
        occupancy.count = list.length;
        occupancy.instanceMatrix.needsUpdate = true;
      }
    });
  }

  useFrame(() => {
    const list = posesRef?.current ?? instances;
    if (!list || list.length === 0) return;
    writeMatrices(list);
  });

  useLayoutEffect(() => {
    const apply = (look: boolean) => {
      parts.forEach((part, index) => {
        if (part.waterway) {
          const instanced = meshRefs.current[index];
          if (instanced) instanced.visible = true;
          const occupancy = occupancyRefs.current[index];
          if (occupancy) occupancy.visible = false;
          setWaterwayOccupancyEmissive(part.material, look);
          return;
        }

        const instanced = meshRefs.current[index];
        const occupancy = occupancyRefs.current[index];
        if (instanced) instanced.visible = !look;
        if (occupancy) occupancy.visible = look;
      });
    };

    apply(useOccupancyStore.getState().occupancyLook);
    return useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(state.occupancyLook);
    });
  }, [parts]);

  const count = instances?.length ?? 0;
  if (count === 0) return null;

  return (
    <group>
      {parts.map((part, index) => (
        <group key={index}>
          <instancedMesh
            ref={(node) => {
              meshRefs.current[index] = node;
            }}
            args={[part.geometry, part.material, count]}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
          {part.waterway ? null : (
            <instancedMesh
              ref={(node) => {
                occupancyRefs.current[index] = node;
              }}
              args={[part.geometry, occupancyMaterial, count]}
              visible={false}
              frustumCulled={false}
              castShadow
              receiveShadow
            />
          )}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(shipUrl);
