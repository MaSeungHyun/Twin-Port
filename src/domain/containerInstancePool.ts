import { BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type Material, type Object3D } from "three";
import { CONTAINER_COLOR_ATTR } from "@/domain/containerPrototype";

/** LOD/Depth가 바뀌어도 블록·색마다 같은 객체와 인스턴스 버퍼를 유지한다. */
export function ensureContainerBlockMesh(
  meshes: Map<string, InstancedMesh>,
  root: Object3D,
  code: string,
  color: string,
  geometry: BufferGeometry,
  materials: readonly [Material, Material, Material],
  capacity: number,
) {
  const key = `${code}|${color}`;
  let mesh = meshes.get(key);
  if (mesh && mesh.geometry !== geometry) {
    mesh.removeFromParent();
    mesh.dispose();
    meshes.delete(key);
    mesh = undefined;
  }
  if (!mesh) {
    mesh = new InstancedMesh(geometry, materials[0], capacity);
    mesh.name = `yard-${key}`;
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.renderOrder = 10;
    mesh.raycast = () => null;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    root.add(mesh);
    meshes.set(key, mesh);
  }
  // Three의 instancing 캐시는 객체별이다. 대표 색 한 개만 예열하면 다른 블록은 빠진다.
  mesh.userData.warmMaterials = materials;
  return mesh;
}

/**
 * [perf] 블록 1개 = 통합 InstancedMesh 1개 (색별 메시 4개 대신). 색은 인스턴스 attribute(containerColor)로 넘긴다.
 * geometry 는 블록마다 따로(위치·법선·UV·인덱스는 공유, 색 인덱스 버퍼만 블록 소유)라 셰이더/파이프라인은 같다.
 */
export function ensureUnifiedContainerBlockMesh(
  meshes: Map<string, InstancedMesh>,
  root: Object3D,
  code: string,
  base: BufferGeometry,
  materials: readonly [Material, Material, Material],
  capacity: number,
) {
  const key = `${code}|*`;
  let mesh = meshes.get(key);
  if (mesh && mesh.userData.unifiedBase !== base) {
    mesh.removeFromParent();
    mesh.dispose();
    meshes.delete(key);
    mesh = undefined;
  }
  if (!mesh) {
    const geometry = new BufferGeometry();
    geometry.setIndex(base.getIndex());
    for (const name of Object.keys(base.attributes)) geometry.setAttribute(name, base.getAttribute(name));
    const colors = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    colors.setUsage(DynamicDrawUsage);
    geometry.setAttribute(CONTAINER_COLOR_ATTR, colors);
    geometry.boundingBox = base.boundingBox;
    geometry.boundingSphere = base.boundingSphere;
    mesh = new InstancedMesh(geometry, materials[0], capacity);
    mesh.name = `yard-${key}`;
    mesh.userData.unifiedBase = base;
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.renderOrder = 10;
    mesh.raycast = () => null;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    root.add(mesh);
    meshes.set(key, mesh);
  }
  mesh.userData.warmMaterials = materials;
  return mesh;
}