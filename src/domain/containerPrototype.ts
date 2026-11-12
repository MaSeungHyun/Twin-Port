import {
  CONTAINER_COLORS,
  CONTAINER_D,
  CONTAINER_H,
  CONTAINER_W,
  type ContainerColorKey,
} from "@/constants/container";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  FrontSide,
  type Material,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { attribute, type float, select, texture, uniform, uv, varying, type vec2, vec4 } from "three/tsl";

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
  // MeshStandardMaterial이 아니면 흰색 기본 + 원본 color/map 유지
  const material = new MeshStandardMaterial({ color: 0xffffff });
  if (source) {
    material.side = source.side;
    const src = source as Material & { color?: Color; map?: MeshStandardMaterial["map"] };
    if (src.color instanceof Color) material.color.copy(src.color);
    if (src.map) material.map = src.map;
  }
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
    material.side = FrontSide; // 더블사이드 끔 (GLB 설정 무시)

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

/** [perf] 통합 컨테이너 메시의 인스턴스별 색 인덱스 attribute 이름 (CONTAINER_COLORS 순서) */
export const CONTAINER_COLOR_ATTR = "containerColor";

/**
 * [perf] 색 그룹 4개는 같은 상자(정점 24개)에 UV 영역만 다르다. 첫 색 geometry 의 위치·법선·인덱스를 쓰고
 * 색마다의 UV 를 uv / uv1 / uv2 / uv3 으로 담은 geometry 를 만든다. 정점 대응이 하나라도 안 맞으면 null (기존 색별 메시 유지).
 */
export function buildUnifiedContainerGeometry(
  prototypes: Record<ContainerColorKey, ContainerPrototype>,
): BufferGeometry | null {
  const keys = CONTAINER_COLORS.map((c) => c.key);
  if (keys.length === 0 || keys.length > 4) return null;
  const base = prototypes[keys[0]!].geometry;
  const pos = base.getAttribute("position");
  const nor = base.getAttribute("normal");
  if (!pos || !nor) return null;
  base.computeBoundingBox();
  const size = base.boundingBox!.getSize(new Vector3()).length();
  const eps = Math.max(size * 1e-4, 1e-5);
  const out = new BufferGeometry();
  out.setIndex(base.getIndex());
  for (const name of Object.keys(base.attributes)) {
    if (/^uv\d*$/.test(name)) continue;
    out.setAttribute(name, base.getAttribute(name));
  }
  for (let k = 0; k < keys.length; k += 1) {
    const g = prototypes[keys[k]!].geometry;
    const gp = g.getAttribute("position");
    const gn = g.getAttribute("normal");
    const guv = g.getAttribute("uv");
    if (!gp || !gn || !guv || gp.count !== pos.count) {
      out.dispose();
      return null;
    }
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      let found = -1;
      for (let j = 0; j < gp.count; j += 1) {
        if (Math.abs(gp.getX(j) - pos.getX(i)) > eps || Math.abs(gp.getY(j) - pos.getY(i)) > eps || Math.abs(gp.getZ(j) - pos.getZ(i)) > eps) continue;
        const dot = gn.getX(j) * nor.getX(i) + gn.getY(j) * nor.getY(i) + gn.getZ(j) * nor.getZ(i);
        if (dot < 0.99) continue;
        found = j;
        break;
      }
      if (found < 0) {
        out.dispose();
        return null;
      }
      uvs[i * 2] = guv.getX(found);
      uvs[i * 2 + 1] = guv.getY(found);
    }
    out.setAttribute(k === 0 ? "uv" : `uv${k}`, new BufferAttribute(uvs, 2));
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * [perf] 인스턴스 색 인덱스로 uv~uv3 중 하나를 골라 map 을 읽는 colorNode 를 붙인다 (원래 color × map 과 같은 결과).
 * 페이드 복제본(clone 은 colorNode 를 복사하지 않음)에도 다시 붙인다. 이미 붙어 있으면 그대로 둔다(재컴파일 방지).
 */
export function applyUnifiedContainerColor(material: Material) {
  const m = material as MeshStandardMaterial & { colorNode?: unknown };
  // clone 은 userData 는 복사하지만 colorNode 는 복사하지 않으므로 둘 다 확인한다.
  if (m.colorNode && material.userData.unifiedContainerColor) return material;
  const map = m.map;
  if (!map) return material;
  const ci = attribute(CONTAINER_COLOR_ATTR, "float") as unknown as ReturnType<typeof float>;
  const uvAt = (index: number) => uv(index) as unknown as ReturnType<typeof vec2>;
  const pick = varying(
    select(ci.lessThan(0.5), uvAt(0), select(ci.lessThan(1.5), uvAt(1), select(ci.lessThan(2.5), uvAt(2), uvAt(3)))),
  );
  m.colorNode = texture(map, pick).mul(vec4(uniform(m.color), 1));
  m.userData.unifiedContainerColor = true;
  m.needsUpdate = true;
  return material;
}

/** 통합 메시용 기본 재질: 첫 색 재질 복제 + 인스턴스 색 colorNode */
export function buildUnifiedContainerMaterial(prototypes: Record<ContainerColorKey, ContainerPrototype>) {
  const source = prototypes[CONTAINER_COLORS[0]!.key].material;
  const material = source.clone();
  material.name = `${source.name || "container"}-unified`;
  return applyUnifiedContainerColor(material) as MeshStandardMaterial;
}