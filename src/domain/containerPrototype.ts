import {
  CONTAINER_COLORS,
  CONTAINER_D,
  CONTAINER_H,
  CONTAINER_W,
  type ContainerColorKey,
} from "@/constants/container";
import {
  Box3,
  type BufferGeometry,
  Color,
  EdgesGeometry,
  type Material,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ContainerPrototype = {
  geometry: BufferGeometry;
  edgeGeometry: EdgesGeometry;
  material: MeshStandardMaterial;
  highlightMaterial: MeshStandardMaterial;
};

const HIGHLIGHT_EMISSIVE = new Color(0x22c55e);

function toStandardMaterial(source?: Material): MeshStandardMaterial {
  if (source instanceof MeshStandardMaterial) {
    return source.clone();
  }
  const material = new MeshStandardMaterial({ color: 0xffffff });
  if (source) material.side = source.side;
  return material;
}

/** GLB 색상 그룹(blue/red/…)을 슬롯 치수에 맞게 정규화한 InstancedMesh 프로토타입 */
export function buildContainerPrototypes(
  scene: Object3D,
): Record<ContainerColorKey, ContainerPrototype> {
  scene.updateMatrixWorld(true);

  const prototypes = {} as Record<ContainerColorKey, ContainerPrototype>;

  for (const { key } of CONTAINER_COLORS) {
    const group = scene.getObjectByName(key);
    if (!group) {
      throw new Error(`containers.glb missing color group "${key}"`);
    }

    const box = new Box3().setFromObject(group);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // 모델 장축=X, 슬롯 장축=Z → Y축 +90° 후 슬롯 치수로 스케일
    const normalize = new Matrix4()
      .makeScale(
        CONTAINER_W / size.z,
        CONTAINER_H / size.y,
        CONTAINER_D / size.x,
      )
      .multiply(new Matrix4().makeRotationY(Math.PI / 2))
      .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));

    const geos: BufferGeometry[] = [];
    let sourceMaterial: Material | undefined;

    group.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (!sourceMaterial) {
        sourceMaterial = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
      }

      const geo = mesh.geometry.clone();
      geo.applyMatrix4(
        new Matrix4().multiplyMatrices(normalize, mesh.matrixWorld),
      );
      geos.push(geo);
    });

    if (geos.length === 0) {
      throw new Error(`containers.glb group "${key}" has no meshes`);
    }

    const geometry = mergeGeometries(geos, false);
    if (!geometry) {
      throw new Error(`Failed to merge geometries for "${key}"`);
    }
    for (const geo of geos) geo.dispose();

    const material = toStandardMaterial(sourceMaterial);
    material.roughness = 0.6;
    material.metalness = 0.35;

    const highlightMaterial = material.clone();
    highlightMaterial.emissive = HIGHLIGHT_EMISSIVE.clone();
    highlightMaterial.emissiveIntensity = 1.2;
    highlightMaterial.roughness = 0.45;

    prototypes[key] = {
      geometry,
      edgeGeometry: new EdgesGeometry(geometry),
      material,
      highlightMaterial,
    };
  }

  return prototypes;
}
