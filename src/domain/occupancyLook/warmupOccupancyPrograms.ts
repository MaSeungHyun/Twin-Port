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
import { getOccupancyContainerMaterial } from "./occupancyContainerMaterial";
import { getOccupancyShipMaterial } from "./occupancyShipMaterial";
import { getOccupancySurfaceMaterial } from "./occupancySurfaceMaterial";

let programsWarmed = false;

/**
 * occupancy 셰이더를 미리 컴파일 (지형 / 선체 / 컨테이너 instancing + 바 재질).
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
  const ship = getOccupancyShipMaterial();
  const container = getOccupancyContainerMaterial();
  const instanced = new InstancedMesh(geo, surface, 1);
  instanced.count = 1;
  instanced.frustumCulled = false;
  const shipInstanced = new InstancedMesh(geo, ship, 1);
  shipInstanced.count = 1;
  shipInstanced.frustumCulled = false;
  const containerInstanced = new InstancedMesh(geo, container, 1);
  containerInstanced.count = 1;
  containerInstanced.frustumCulled = false;

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

  scene.add(instanced, shipInstanced, containerInstanced, shell, fill, line);
  gl.compile(scene, camera);
  scene.remove(
    instanced,
    shipInstanced,
    containerInstanced,
    shell,
    fill,
    line,
  );

  shell.material.dispose();
  fill.material.dispose();
  line.material.dispose();
  line.geometry.dispose();
  instanced.dispose();
  shipInstanced.dispose();
  containerInstanced.dispose();
  geo.dispose();
  programsWarmed = true;
}
