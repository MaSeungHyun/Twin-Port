import {
  CONTAINER_COLORS,
  CONTAINER_D,
  CONTAINER_H,
  CONTAINER_W,
  type ContainerColorKey,
} from "@/constants/container";
import {
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

/** 장축을 로컬 +Z(Bay)에 맞추고 CONTAINER_D로 균일 스케일 */
function alignLengthToLocalZ(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const firstBox = geometry.boundingBox;
  if (!firstBox || firstBox.isEmpty()) return;

  const origin = firstBox.getCenter(new Vector3());
  geometry.applyMatrix4(
    new Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z),
  );

  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) return;

  let meanX = 0;
  let meanZ = 0;
  for (let i = 0; i < position.count; i += 1) {
    meanX += position.getX(i);
    meanZ += position.getZ(i);
  }
  meanX /= position.count;
  meanZ /= position.count;

  let xx = 0;
  let xz = 0;
  let zz = 0;
  for (let i = 0; i < position.count; i += 1) {
    const dx = position.getX(i) - meanX;
    const dz = position.getZ(i) - meanZ;
    xx += dx * dx;
    xz += dx * dz;
    zz += dz * dz;
  }

  const yaw = 0.5 * Math.atan2(2 * xz, xx - zz);
  geometry.applyMatrix4(new Matrix4().makeRotationY(-yaw));
  geometry.computeBoundingBox();

  const aligned = geometry.boundingBox?.getSize(new Vector3());
  if (aligned && aligned.x > aligned.z) {
    geometry.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2));
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return;
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const uniform = CONTAINER_D / Math.max(size.z, 1e-6);
  geometry.applyMatrix4(
    new Matrix4()
      .makeScale(uniform, uniform, uniform)
      .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z)),
  );

  geometry.computeBoundingBox();
  const fitted = geometry.boundingBox;
  if (fitted && !fitted.isEmpty()) {
    const fittedSize = fitted.getSize(new Vector3());
    const fittedCenter = fitted.getCenter(new Vector3());
    const widthScale = CONTAINER_W / Math.max(fittedSize.x, 1e-6);
    const heightScale = CONTAINER_H / Math.max(fittedSize.y, 1e-6);
    geometry.applyMatrix4(
      new Matrix4()
        .makeScale(widthScale, heightScale, 1)
        .multiply(
          new Matrix4().makeTranslation(-fittedCenter.x, -fittedCenter.y, 0),
        ),
    );
  }
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
      geo.applyMatrix4(mesh.matrixWorld);
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
    alignLengthToLocalZ(geometry);

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
