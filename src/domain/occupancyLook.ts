import {
  BoxGeometry,
  EdgesGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";

export const OCCUPANCY_SURFACE_OPACITY = 0.28;

let occupancySurface: MeshStandardMaterial | null = null;
let programsWarmed = false;

/** occupancy 지형·선체 공통 표면 — 앱 수명 동안 1개만 유지 */
export function getOccupancySurfaceMaterial() {
  occupancySurface ??= new MeshStandardMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: OCCUPANCY_SURFACE_OPACITY,
    depthWrite: false,
    roughness: 0.9,
    metalness: 0.05,
  });
  return occupancySurface;
}

export function createOccupancySurfaceMaterial() {
  return getOccupancySurfaceMaterial();
}

/**
 * occupancy 셰이더를 미리 컴파일 (지형 실메시 + 선체 instancing + 바 재질).
 * 페인트 전에 호출해야 화면에 occupancy 룩이 비치지 않음.
 */
export function warmupOccupancyPrograms(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
) {
  if (programsWarmed) return;

  const geo = new BoxGeometry(1, 1, 1);
  const surface = getOccupancySurfaceMaterial();
  const instanced = new InstancedMesh(geo, surface, 1);
  instanced.count = 1;
  instanced.frustumCulled = false;

  const shell = new Mesh(
    geo,
    new MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  const fill = new Mesh(
    geo,
    new MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const line = new LineSegments(
    new EdgesGeometry(geo),
    new LineBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.4,
    }),
  );

  scene.add(instanced, shell, fill, line);
  gl.compile(scene, camera);
  scene.remove(instanced, shell, fill, line);

  shell.material.dispose();
  fill.material.dispose();
  line.material.dispose();
  line.geometry.dispose();
  instanced.dispose();
  geo.dispose();
  programsWarmed = true;
}
