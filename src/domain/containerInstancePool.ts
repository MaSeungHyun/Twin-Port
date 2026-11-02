import { DynamicDrawUsage, InstancedMesh, type BufferGeometry, type Material, type Object3D } from "three";

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
