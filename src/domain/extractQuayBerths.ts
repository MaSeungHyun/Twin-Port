import {
  SHIP_BERTH_OFFSETS,
  SHIP_BERTH_TUNE,
  SHIP_POSITION_Y,
  SHIP_SCALE,
} from "@/constants/model";
import { yawToward } from "@/constants/shipCargo";
import { findQuayCraneRoot } from "@/domain/hoverOutline";
import {
  formatQuayCraneGlbName,
  parseCraneNameIndex,
  parseQuayCraneGlbIndex,
} from "@/domain/quayCraneIndex";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Object3D,
  Vector3,
} from "three";

export type QuayBerth = ShipInstance & {
  kind: "crane" | "kran" | "unknown";
  craneCount: number;
  outward: [number, number];
  /** Blender Ship / Ship.001… 인덱스. 없으면 배열 순번 */
  locatorIndex?: number;
};

type CraneSpot = {
  kind: "crane" | "kran" | "unknown";
  mesh: string;
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
  /** 인스턴스 원점(레일/발판) */
  baseX: number;
  baseY: number;
  baseZ: number;
  /** 원점에서 붐 끝까지 거리 */
  boomReach: number;
  boomBack: number;
  /** 붐이 바다 쪽으로 뻗는 XZ 방향 */
  boomX: number;
  boomZ: number;
  /** 3D hover / tracking outline id (rootUuid or rootUuid:instanceId) */
  hoverId?: string;
  /** GLB 노드명 crane.052 → 52 */
  glbIndex?: number;
};

function namesOf(object: Object3D) {
  const geometryName = (object as Mesh).isMesh
    ? (object as Mesh).geometry?.name
    : "";
  return [object.name, object.parent?.name ?? "", geometryName ?? ""];
}

function isInstanced(object: Object3D): object is InstancedMesh {
  return (object as InstancedMesh).isInstancedMesh === true;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function kindFromNames(names: string[]): CraneSpot["kind"] {
  const text = names.join(" ");
  if (/kran/i.test(text)) return "kran";
  if (/crane/i.test(text) && !/overhead/i.test(text)) return "crane";
  return "unknown";
}

function isIgnoredMesh(names: string[]) {
  return names.some((name) =>
    /^(ground|road|limitline|bush|plane|cube|containerstack|wse)/i.test(name),
  ) || names.some((name) => /overhead/i.test(name));
}

function isNamedQuayCrane(names: string[]) {
  return kindFromNames(names) !== "unknown";
}

function isFallbackCraneMesh(names: string[]) {
  const text = names.join(" ");
  return /buildingmesh/i.test(text);
}

function collectSpots(
  root: Object3D,
  predicate: (names: string[]) => boolean,
): CraneSpot[] {
  const spots: CraneSpot[] = [];
  const world = new Matrix4();
  const instance = new Matrix4();
  const box = new Box3();
  const center = new Vector3();
  const origin = new Vector3();
  const corner = new Vector3();
  const seen = new Set<Object3D>();

  root.traverse((child) => {
    if (!isMesh(child) || isIgnoredMesh(namesOf(child))) return;
    const names = namesOf(child);
    if (!predicate(names)) return;

    const kind = kindFromNames(names);
    const mesh = names.find(Boolean) || child.name || "crane";

    const pushBox = (matrix: Matrix4, instanceIndex?: number) => {
      const geometry = child.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      box.copy(geometry.boundingBox).applyMatrix4(matrix);
      if (box.isEmpty()) return;
      box.getCenter(center);
      origin.setFromMatrixPosition(matrix);
      const size = box.getSize(new Vector3());
      const boom = boomFromMatrix(geometry.boundingBox, matrix);
      let boomReach = 0;
      let boomBack = 0;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            corner.set(x, y, z);
            const along =
              (corner.x - origin.x) * boom.x + (corner.z - origin.z) * boom.z;
            boomReach = Math.max(boomReach, along);
            boomBack = Math.max(boomBack, -along);
          }
        }
      }

      let hoverId: string | undefined;
      const craneRoot = findQuayCraneRoot(child);
      if (craneRoot) {
        hoverId =
          instanceIndex != null
            ? `${craneRoot.uuid}:${instanceIndex}`
            : craneRoot.uuid;
      }

      const glbIndex = parseQuayCraneGlbIndex(child);

      spots.push({
        kind,
        mesh,
        x: center.x,
        y: center.y,
        z: center.z,
        height: size.y,
        radius: Math.max(size.x, size.z) * 0.5,
        baseX: origin.x,
        baseY: origin.y,
        baseZ: origin.z,
        boomReach: Math.max(boomReach, 0.2),
        boomBack: Math.max(boomBack, 0.2),
        boomX: boom.x,
        boomZ: boom.z,
        hoverId,
        glbIndex: glbIndex ?? undefined,
      });
    };

    if (isInstanced(child)) {
      const holder =
        child.parent && child.parent !== root ? child.parent : child;
      if (seen.has(holder)) return;
      seen.add(holder);
      for (let i = 0; i < child.count; i += 1) {
        child.getMatrixAt(i, instance);
        world.multiplyMatrices(child.matrixWorld, instance);
        pushBox(world.clone(), i);
      }
      return;
    }

    pushBox(child.matrixWorld);
  });

  return spots;
}

function boomFromMatrix(localBox: Box3, world: Matrix4) {
  const extent = [
    localBox.max.x - localBox.min.x,
    localBox.max.y - localBox.min.y,
    localBox.max.z - localBox.min.z,
  ];
  let bestLen = -1;
  let boomX = 1;
  let boomZ = 0;
  for (let index = 0; index < 3; index += 1) {
    const axis = new Vector3().setFromMatrixColumn(world, index);
    const xzLen = Math.hypot(axis.x, axis.z);
    if (xzLen < 1e-8) continue;
    const worldSize = Math.max(extent[index]!, 1e-8) * axis.length();
    if (worldSize <= bestLen) continue;
    bestLen = worldSize;
    boomX = axis.x / xzLen;
    boomZ = axis.z / xzLen;
  }
  return { x: boomX, z: boomZ };
}

function keepTallSpots(spots: CraneSpot[]) {
  if (spots.length < 3) return spots;
  const heights = [...spots.map((s) => s.height)].sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)]!;
  const cut = Math.max(median * 1.15, heights[Math.floor(heights.length * 0.45)]!);
  const tall = spots.filter((s) => s.height >= cut);
  return tall.length >= 3 ? tall : spots;
}

function preferredSize(kind: CraneSpot["kind"], count: number) {
  if (kind === "crane") return 3;
  if (kind === "kran") return count % 4 === 0 ? 4 : 3;
  if (count % 3 === 0) return 3;
  if (count % 4 === 0) return 4;
  return 3;
}

function clusterSpots(spots: CraneSpot[]): CraneSpot[][] {
  if (spots.length === 0) return [];

  const meanX = spots.reduce((s, p) => s + p.baseX, 0) / spots.length;
  const meanZ = spots.reduce((s, p) => s + p.baseZ, 0) / spots.length;
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const p of spots) {
    const dx = p.baseX - meanX;
    const dz = p.baseZ - meanZ;
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  }
  const split = Math.hypot(xx - zz, 2 * xz);
  const alongX = xx - zz + split;
  const alongZ = 2 * xz;
  const alongLen = Math.hypot(alongX, alongZ) || 1;
  const ax = alongX / alongLen;
  const az = alongZ / alongLen;

  const sorted = [...spots].sort(
    (a, b) => a.baseX * ax + a.baseZ * az - (b.baseX * ax + b.baseZ * az),
  );
  const gaps = sorted.slice(1).map((p, i) => {
    const prev = sorted[i]!;
    return Math.hypot(p.baseX - prev.baseX, p.baseZ - prev.baseZ);
  });
  const gapSorted = [...gaps].sort((a, b) => a - b);
  const medianGap = gapSorted[Math.floor(gapSorted.length / 2)] ?? 8;
  const splitGap = Math.max(medianGap * 2.4, 1e-3);
  const size = preferredSize(spots[0]?.kind ?? "unknown", spots.length);

  const groups: CraneSpot[][] = [];
  let current: CraneSpot[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const spot = sorted[i]!;
    if (current.length === 0) {
      current = [spot];
      continue;
    }
    const gap = gaps[i - 1] ?? 0;
    if (gap > splitGap || current.length >= size) {
      groups.push(current);
      current = [spot];
    } else {
      current.push(spot);
    }
  }
  if (current.length) groups.push(current);

  return groups.filter((group) => group.length >= 2);
}

function berthFromGroup(
  group: CraneSpot[],
  land: { x: number; z: number },
): QuayBerth {
  const cx = group.reduce((s, p) => s + p.baseX, 0) / group.length;
  const cz = group.reduce((s, p) => s + p.baseZ, 0) / group.length;

  let ox = group.reduce((s, p) => s + p.boomX, 0);
  let oz = group.reduce((s, p) => s + p.boomZ, 0);
  const boomLen = Math.hypot(ox, oz) || 1;
  ox /= boomLen;
  oz /= boomLen;

  const toLandX = land.x - cx;
  const toLandZ = land.z - cz;
  if (ox * toLandX + oz * toLandZ > 0) {
    ox = -ox;
    oz = -oz;
  }

  const aligned =
    group.reduce((s, p) => s + p.boomX * ox + p.boomZ * oz, 0) >= 0;
  const reach =
    group.reduce(
      (s, p) => s + (aligned ? p.boomReach : p.boomBack),
      0,
    ) / Math.max(group.length, 1);

  const lx = -oz;
  const lz = ox;
  const along = SHIP_BERTH_TUNE.along;
  const standoff = reach + SHIP_BERTH_TUNE.out;
  const kind = group[0]?.kind ?? "unknown";

  return {
    kind,
    craneCount: group.length,
    outward: [ox, oz],
    position: [
      cx + ox * standoff + lx * along,
      SHIP_POSITION_Y,
      cz + oz * standoff + lz * along,
    ],
    rotation: [0, yawToward(lx, lz) + SHIP_BERTH_TUNE.yaw, 0],
    scale: SHIP_SCALE,
  };
}

function landCentroid(root: Object3D, fallbackSpots: CraneSpot[]) {
  const box = new Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const c = box.getCenter(new Vector3());
    return { x: c.x, z: c.z };
  }
  if (fallbackSpots.length === 0) return { x: 0, z: 0 };
  return {
    x: fallbackSpots.reduce((s, p) => s + p.x, 0) / fallbackSpots.length,
    z: fallbackSpots.reduce((s, p) => s + p.z, 0) / fallbackSpots.length,
  };
}

/** Crane(3대) / Kran(3~4대) 묶음마다 안벽 앞에 선박 1척. */
export function extractQuayBerths(root: Object3D): QuayBerth[] {
  root.updateMatrixWorld(true);

  const named = collectSpots(root, isNamedQuayCrane);
  const spots = keepTallSpots(
    named.length >= 3 ? named : collectSpots(root, isFallbackCraneMesh),
  );
  if (spots.length < 2) return [];

  const land = landCentroid(root, spots);
  const byKey = new Map<string, CraneSpot[]>();
  for (const spot of spots) {
    const key = `${spot.kind}:${spot.mesh}`;
    const list = byKey.get(key) ?? [];
    list.push(spot);
    byKey.set(key, list);
  }

  const berths: QuayBerth[] = [];
  for (const groupSpots of byKey.values()) {
    for (const group of clusterSpots(groupSpots)) {
      berths.push(berthFromGroup(group, land));
    }
  }

  berths.sort((a, b) => {
    if (Math.abs(a.position[2] - b.position[2]) > 0.5)
      return a.position[2] - b.position[2];
    return a.position[0] - b.position[0];
  });

  for (let i = 0; i < berths.length; i += 1) {
    const extra = SHIP_BERTH_OFFSETS[i];
    if (!extra) continue;
    const berth = berths[i]!;
    const [ox, oz] = berth.outward;
    const lx = -oz;
    const lz = ox;
    const out = extra.out ?? 0;
    const along = extra.along ?? 0;
    const yaw = extra.yaw ?? 0;
    berth.position[0] += ox * out + lx * along;
    berth.position[2] += oz * out + lz * along;
    if (berth.rotation) berth.rotation[1] += yaw;
  }

  if (import.meta.env.DEV) {
    console.info(
      `[Quay] ships=${berths.length} cranes=${spots.length}`,
      berths.map(
        (b, i) =>
          `${i}: ${b.kind}×${b.craneCount} @ ${b.position.map((n) => n.toFixed(1)).join(",")}`,
      ),
    );
  }

  return berths;
}

export type QuayCranePlacement = {
  /** GLB 노드 crane.NNN 숫자 — tracking·UI 키 */
  glbIndex: number;
  kind: "crane" | "kran" | "unknown";
  mesh: string;
  /** GLB bbox center — camera look-at */
  position: [number, number, number];
  height: number;
  /** 3D hover / tracking outline id */
  hoverId?: string;
};

/** GLB crane / crane.001 … 루트 노드 (0~75) */
function collectQuayCraneRootNodes(root: Object3D): Object3D[] {
  const byIndex = new Map<number, Object3D>();
  root.traverse((child) => {
    const glbIndex = parseCraneNameIndex(child.name);
    if (glbIndex == null || byIndex.has(glbIndex)) return;
    byIndex.set(glbIndex, child);
  });
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, node]) => node);
}

/** BUSAN.glb quay crane 인스턴스 월드 좌표 (UI·카메라 tracking용) */
export function extractQuayCranePlacements(
  root: Object3D,
): QuayCranePlacement[] {
  root.updateMatrixWorld(true);
  const box = new Box3();
  const center = new Vector3();
  const size = new Vector3();

  return collectQuayCraneRootNodes(root).map((node) => {
    const glbIndex = parseCraneNameIndex(node.name)!;
    box.setFromObject(node);
    box.getCenter(center);
    box.getSize(size);
    return {
      glbIndex,
      kind: kindFromNames([node.name]),
      mesh: formatQuayCraneGlbName(glbIndex),
      position: [center.x, center.y, center.z],
      height: size.y,
      hoverId: node.uuid,
    };
  });
}
