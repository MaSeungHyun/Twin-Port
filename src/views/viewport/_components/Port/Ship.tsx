import shipUrl from "@/assets/model/ship_empty.glb";
import { enableGlbShadows } from "@/domain/glb";
import {
  DEBUG_SHIP_OCCUPANCY_MATERIAL,
  OCCUPANCY_SHIP_COLOR,
  getOccupancyShipMaterial,
} from "@/domain/occupancyLook/occupancyShipMaterial";
import {
  hoveredIndexOf,
  instanceHoverId,
  portHoverOut,
  portHoverOver,
  subscribePortHover,
} from "@/domain/hoverOutline";
import { SHIP_TWEEN, WATERWAY_FULL_SPEED } from "@/constants/tween";
import { useOccupancyStore } from "@/stores/occupancy";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
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
import HoverOutlineMesh from "./HoverOutlineMesh";

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
  return Array.isArray(source)
    ? source.map((mat) => mat.clone())
    : source.clone();
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

const WATERWAY_MIN_MOVE = 0.0004;
const WATERWAY_MIN_SCALE = 0.4;
const WATERWAY_HOLD = 0.22;
const WATERWAY_GROW = 2.2;
const WATERWAY_SHRINK = 3.4;

function straightSpeedRatio(
  instance: ShipInstance,
  prev: [number, number] | undefined,
  next: [number, number],
  dt: number,
) {
  if (instanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2) return 0;
  if (!prev || dt <= 1e-4) return 0;
  const dx = next[0] - prev[0];
  const dz = next[1] - prev[1];
  const moved = Math.hypot(dx, dz);
  if (moved < WATERWAY_MIN_MOVE) return 0;
  const yaw = instance.rotation?.[1] ?? 0;
  const along = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
  if (Math.abs(along) < moved * 0.75) return 0;
  return Math.min(1, moved / dt / WATERWAY_FULL_SPEED);
}

function followWaterway(current: number, target: number, dt: number) {
  if (target <= 0 && current < 0.01) return 0;
  if (target >= WATERWAY_MIN_SCALE && current <= 0)
    current = WATERWAY_MIN_SCALE;
  const rate = target >= current ? WATERWAY_GROW : WATERWAY_SHRINK;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
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
  const outlineRefs = useRef<(Mesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const lastPos = useRef<([number, number] | undefined)[]>([]);
  const waterwayOn = useRef<number[]>([]);
  const waterwayHold = useRef<number[]>([]);
  const waterwaySpeed = useRef<number[]>([]);

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

  const applyHoverOutline = useCallback((list: ShipInstance[]) => {
    const hoverIndex = hoveredIndexOf("ship");
    const hovered = hoverIndex >= 0 ? list[hoverIndex] : undefined;
    const showOutline =
      hovered != null && instanceScale(hovered) > SHIP_TWEEN.hiddenScale * 2;

    parts.forEach((part, partIndex) => {
      const outline = outlineRefs.current[partIndex];
      if (!outline) return;
      if (!showOutline || part.waterway) {
        outline.visible = false;
        return;
      }
      const source =
        occupancyRefs.current[partIndex] ?? meshRefs.current[partIndex];
      if (!source) {
        outline.visible = false;
        return;
      }
      source.getMatrixAt(hoverIndex, outline.matrix);
      outline.matrixWorldNeedsUpdate = true;
      outline.visible = true;
    });
  }, [parts]);

  function writeMatrices(list: ShipInstance[], dt: number) {
    if (list.length === 0) return;

    if (waterwayOn.current.length !== list.length) {
      waterwayOn.current = new Array(list.length).fill(0);
      waterwayHold.current = new Array(list.length).fill(0);
      waterwaySpeed.current = new Array(list.length).fill(0);
      lastPos.current = new Array(list.length);
    }

    const step = Math.min(Math.max(dt, 1 / 120), 0.05);

    list.forEach((instance, index) => {
      const next: [number, number] = [
        instance.position[0],
        instance.position[2],
      ];
      if (instanceScale(instance) <= SHIP_TWEEN.hiddenScale * 2) {
        waterwayHold.current[index] = 0;
        waterwaySpeed.current[index] = 0;
        waterwayOn.current[index] = 0;
        lastPos.current[index] = next;
        return;
      }

      const ratio = straightSpeedRatio(
        instance,
        lastPos.current[index],
        next,
        step,
      );

      if (ratio > 0) {
        waterwayHold.current[index] = WATERWAY_HOLD;
        const prevSpeed = waterwaySpeed.current[index] ?? 0;
        waterwaySpeed.current[index] =
          prevSpeed + (ratio - prevSpeed) * (1 - Math.exp(-5 * step));
      } else {
        waterwayHold.current[index] = Math.max(
          0,
          (waterwayHold.current[index] ?? 0) - step,
        );
      }

      const holding = (waterwayHold.current[index] ?? 0) > 0;
      const speed = waterwaySpeed.current[index] ?? 0;
      const target = holding
        ? WATERWAY_MIN_SCALE + (1 - WATERWAY_MIN_SCALE) * speed
        : 0;

      waterwayOn.current[index] = followWaterway(
        waterwayOn.current[index] ?? 0,
        target,
        step,
      );
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

    applyHoverOutline(list);
  }

  useFrame((_, delta) => {
    const list = posesRef?.current ?? instances;
    if (!list || list.length === 0) return;
    writeMatrices(list, delta);
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

    const look =
      DEBUG_SHIP_OCCUPANCY_MATERIAL ||
      useOccupancyStore.getState().occupancyLook;
    apply(look);
    return useOccupancyStore.subscribe((state, prev) => {
      if (state.occupancyLook === prev.occupancyLook) return;
      apply(DEBUG_SHIP_OCCUPANCY_MATERIAL || state.occupancyLook);
    });
  }, [parts]);

  useLayoutEffect(() => {
    return subscribePortHover(() => {
      const list = posesRef?.current ?? instances;
      if (!list) return;
      applyHoverOutline(list);
    });
  }, [applyHoverOutline, instances, posesRef]);

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
            visible={!DEBUG_SHIP_OCCUPANCY_MATERIAL}
            onPointerOver={
              part.waterway
                ? undefined
                : (event) => portHoverOver(event, "ship", instanceHoverId(event))
            }
            onPointerOut={
              part.waterway
                ? undefined
                : (event) => portHoverOut(event, "ship", instanceHoverId(event))
            }
          />
          {part.waterway ? null : (
            <instancedMesh
              ref={(node) => {
                occupancyRefs.current[index] = node;
              }}
              args={[part.geometry, occupancyMaterial, count]}
              visible={DEBUG_SHIP_OCCUPANCY_MATERIAL}
              frustumCulled={false}
              castShadow
              receiveShadow
              onPointerOver={(event) =>
                portHoverOver(event, "ship", instanceHoverId(event))
              }
              onPointerOut={(event) =>
                portHoverOut(event, "ship", instanceHoverId(event))
              }
            />
          )}
          {part.waterway ? null : (
            <HoverOutlineMesh
              geometry={part.geometry}
              meshRef={(node) => {
                outlineRefs.current[index] = node;
              }}
            />
          )}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(shipUrl);
