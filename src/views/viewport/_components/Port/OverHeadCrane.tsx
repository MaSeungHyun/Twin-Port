import overheadCraneUrl from "@/assets/model/overhead_crane.glb";
import { enableGlbShadows } from "@/domain/glb";
import { getBlockFadeLevel, getFadeMaterials, isAreaDepthFadeActive } from "@/domain/areaDepthFade";
import {
  hoveredIndexOf,
  instanceHoverId,
  portHoverOut,
  portHoverOver,
} from "@/domain/hoverOutline";
import { useGLTF } from "@react-three/drei";
import { extendKtx2, whenKtx2Ready } from "@/domain/gltfLoaders";
import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box3,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  Object3D,
  Vector3,
} from "three";
import HoverOutlineMesh, { setAlertOutlineVariant } from "./HoverOutlineMesh";
import {
  createBlockCenterCraneInstances,
  setOverheadCraneLivePosition,
  type OverHeadCraneInstance,
} from "./overheadCraneInstances";
import { useYardStore } from "@/stores/yard";
import { getActiveByKind } from "@/stores/useFailureStore";

/** [failure] 동시에 고장 표시 가능한 overhead crane 수 (부품당 outline 슬롯) */
const FAILURE_SLOTS = 3;
import { getActiveOverheadCraneIndex, useViewportStore } from "@/stores/viewport";

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
  const { scene } = useGLTF(overheadCraneUrl, false, true, extendKtx2);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  /** [areafade] 부품별 반투명 인스턴스 메시 [레벨1(구역 밖), 레벨2(그룹 밖)] ? 인덱스 유지 위해 해당 안 되는 쪽엔 0 스케일 행렬 */
  const fadeRefs = useRef<(InstancedMesh | null)[][]>([[], []]);
  const zeroMatrix = useMemo(() => new Matrix4().makeScale(0, 0, 0), []);
  const outlineRefs = useRef<(Mesh | null)[]>([]);
  const failureRefs = useRef<(Mesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const modelSize = useRef(new Vector3(1, 1, 1));
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

    // 모델 정규화: bbox X/Z 중심 → 0, 바닥(minY) → 0 (블록 중심·데크에 정확히 서도록)
    const box = new Box3();
    for (const part of collected) {
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      box.union(part.geometry.boundingBox!.clone().applyMatrix4(part.localMatrix));
    }
    const center = box.getCenter(new Vector3());
    const offset = new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
    for (const part of collected) part.localMatrix.premultiply(offset);
    modelSize.current = box.getSize(new Vector3());

    return collected;
  }, [scene]);

  const applyHoverOutline = useCallback(() => {
    // pointer hover 우선, 없으면 패널 Tracking/상세 포커스 대상
    const pointerIndex = hoveredIndexOf("overheadCrane");
    const hoverIndex =
      pointerIndex >= 0
        ? pointerIndex
        : (getActiveOverheadCraneIndex(useViewportStore.getState()) ?? -1);
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

    // 경고(노랑)·고장(빨강)·복구(초록) outline
    const alerted = getActiveByKind("overheadCrane");
    parts.forEach((_, partIndex) => {
      const instanced = meshRefs.current[partIndex];
      for (let s = 0; s < FAILURE_SLOTS; s += 1) {
        const node = failureRefs.current[partIndex * FAILURE_SLOTS + s];
        if (!node) continue;
        const item = alerted[s];
        if (!item || !instanced || item.index >= instanced.count) {
          node.visible = false;
          continue;
        }
        setAlertOutlineVariant(node, item.state);
        instanced.getMatrixAt(item.index, node.matrix);
        node.matrixWorldNeedsUpdate = true;
        node.visible = true;
      }
    });
  }, [parts]);

  const writeMatrices = useCallback(
    (elapsed: number) => {
      parts.forEach((part, partIndex) => {
        const instanced = meshRefs.current[partIndex];
        if (!instanced) return;
        const fadeA = fadeRefs.current[0]![partIndex];
        const fadeG = fadeRefs.current[1]![partIndex];
        const fading = isAreaDepthFadeActive();

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
          if (partIndex === 0) {
            setOverheadCraneLivePosition(
              index,
              dummy.position.x,
              dummy.position.y,
              dummy.position.z,
            );
          }
          dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));

          const scale = instance.scale ?? 1;
          const size = modelSize.current;
          if (instance.fit) {
            dummy.scale.set(
              instance.fit[0] / Math.max(size.x, 1e-3),
              instance.fit[1] / Math.max(size.y, 1e-3),
              instance.fit[2] / Math.max(size.z, 1e-3),
            );
          } else if (typeof scale === "number") {
            dummy.scale.setScalar(scale);
          } else {
            dummy.scale.set(...scale);
          }

          dummy.updateMatrix();
          matrix.multiplyMatrices(dummy.matrix, part.localMatrix);
          if (!fading) {
            instanced.setMatrixAt(index, matrix);
          } else {
            const level = getBlockFadeLevel(blocks[index]?.code);
            instanced.setMatrixAt(index, level === 0 ? matrix : zeroMatrix);
            fadeA?.setMatrixAt(index, level === 1 ? matrix : zeroMatrix);
            fadeG?.setMatrixAt(index, level === 2 ? matrix : zeroMatrix);
          }
        });

        instanced.count = resolvedInstances.length;
        instanced.instanceMatrix.needsUpdate = true;
        for (const f of [fadeA, fadeG]) {
          if (!f) continue;
          f.count = fading ? resolvedInstances.length : 0;
          f.instanceMatrix.needsUpdate = true;
        }
      });

      applyHoverOutline();
    },
    [applyHoverOutline, blocks, dummy, matrix, parts, resolvedInstances, zeroMatrix],
  );

  useLayoutEffect(() => {
    writeMatrices(0);
  }, [writeMatrices]);

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
          {([1, 2] as const).map((level) => (
            <instancedMesh
              key={`fade-${level}`}
              ref={(node) => {
                fadeRefs.current[level - 1]![index] = node;
              }}
              args={[part.geometry, getFadeMaterials(part.material, level), resolvedInstances.length]}
              castShadow
              receiveShadow
              frustumCulled={false}
              raycast={() => null}
            />
          ))}
          <HoverOutlineMesh
            geometry={part.geometry}
            meshRef={(node) => {
              outlineRefs.current[index] = node;
            }}
          />
          {Array.from({ length: FAILURE_SLOTS }, (_, s) => (
            <HoverOutlineMesh
              key={`fail-${s}`}
              variant="failure"
              geometry={part.geometry}
              meshRef={(node) => {
                failureRefs.current[index * FAILURE_SLOTS + s] = node;
              }}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

whenKtx2Ready(() => useGLTF.preload(overheadCraneUrl, false, true, extendKtx2)); // [perf] KTX2 + meshopt
