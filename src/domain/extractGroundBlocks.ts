import { SLOT_MAX_SIZE, type BlockDefinition } from "@/constants/block";
import { CONTAINER_D, CONTAINER_W } from "@/constants/container";
import type { Vec3 } from "@/constants/geometry";
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  type BufferGeometry,
  type Object3D,
  Vector3,
} from "three";

function isLineObject(object: Object3D) {
  return (
    (object as { isLine?: boolean }).isLine === true ||
    (object as { isLineSegments?: boolean }).isLineSegments === true
  );
}

function hasGeometry(object: Object3D): object is Mesh {
  return isMesh(object) || isLineObject(object);
}

function isBlockName(name: string) {
  if (!name) return false;
  return /block/i.test(name) || /^b\d{1,2}(\.\d+)?$/i.test(name);
}

function isLimitLineName(name: string) {
  return /limitline/i.test(name);
}

/** Blender 기본 바닥. 오브젝트 이름이 Plane이면 야드 블록이 아님 */
function isFloorPlaneObject(object: Object3D) {
  return /^plane(\.\d+)?$/i.test(object.name);
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function isInstanced(object: Object3D): object is InstancedMesh {
  return (object as InstancedMesh).isInstancedMesh === true;
}

function namesOf(object: Object3D) {
  const geometryName = isMesh(object) ? object.geometry?.name : "";
  return [object.name, object.parent?.name ?? "", geometryName ?? ""];
}

function objectIsBlock(object: Object3D) {
  if (isFloorPlaneObject(object)) return false;
  return namesOf(object).some(isBlockName);
}

function parseBlockCode(name: string): string | null {
  const matches = [...name.matchAll(/b[_-]?0*(\d{1,2})/gi)];
  const last = matches.at(-1);
  if (!last?.[1]) return null;
  return `B${String(Number(last[1])).padStart(2, "0")}`;
}

function measureFootprint(geometry: BufferGeometry, world: Matrix4) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const extent = bb
    ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]
    : [2, 0, 2];

  const axes = [0, 1, 2].map((index) => {
    const axis = new Vector3().setFromMatrixColumn(world, index);
    const xz = new Vector3(axis.x, 0, axis.z);
    return {
      index,
      axis,
      xz,
      xzLen: xz.length(),
      worldSize: Math.max(extent[index]!, 1e-8) * axis.length(),
    };
  });
  const horizontal = [...axes]
    .filter((item) => item.xzLen > 1e-8)
    .sort((a, b) => b.xzLen - a.xzLen);
  const long = horizontal[0];
  const short = horizontal[1] ?? horizontal[0];
  const center = new Vector3().setFromMatrixPosition(world);

  if (!long || !short) {
    return {
      origin: [center.x, center.y, center.z] as Vec3,
      sizeX: CONTAINER_W,
      sizeZ: CONTAINER_D,
      yaw: 0,
    };
  }

  const zDir = long.xz.clone().normalize();
  const yaw = Math.atan2(zDir.x, zDir.z);
  const sizeX = short.worldSize;
  const sizeZ = long.worldSize;
  const lx = sizeX / 2;
  const lz = sizeZ / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);

  let maxY = center.y;
  if (bb) {
    const corner = new Vector3();
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          maxY = Math.max(maxY, corner.set(x, y, z).applyMatrix4(world).y);
        }
      }
    }
  }

  return {
    origin: [
      center.x - lx * c - lz * s,
      maxY,
      center.z + lx * s - lz * c,
    ] as Vec3,
    sizeX,
    sizeZ,
    yaw,
  };
}

function cluster1D(values: number[], eps: number) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lines: number[] = [];
  let bucket = [sorted[0]!];
  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i]!;
    if (value - bucket[bucket.length - 1]! <= eps) {
      bucket.push(value);
      continue;
    }
    lines.push(bucket.reduce((sum, n) => sum + n, 0) / bucket.length);
    bucket = [value];
  }
  lines.push(bucket.reduce((sum, n) => sum + n, 0) / bucket.length);
  return lines;
}

function aisleThreshold(gaps: number[]) {
  if (gaps.length === 0) return Infinity;
  const sorted = [...gaps].sort((a, b) => a - b);
  const q20 = sorted[Math.floor((sorted.length - 1) * 0.2)]!;
  const q80 = sorted[Math.floor((sorted.length - 1) * 0.8)]!;
  if (q80 > q20 * 1.55) return (q20 + q80) / 2;
  return sorted[Math.floor(sorted.length * 0.65)]! * 1.35;
}

function spansFromLines(lines: number[]) {
  if (lines.length < 2) return [];
  const gaps = lines.slice(1).map((line, i) => line - lines[i]!);
  const thresh = aisleThreshold(gaps);
  const spans: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < gaps.length; i += 1) {
    if (gaps[i]! <= thresh) continue;
    if (i > start) spans.push({ start: lines[start]!, end: lines[i]! });
    start = i + 1;
  }
  if (start < lines.length - 1) {
    spans.push({ start: lines[start]!, end: lines[lines.length - 1]! });
  }
  return spans;
}

function orientedFromAABB(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
) {
  const width = Math.max(x1 - x0, 1e-4);
  const depth = Math.max(z1 - z0, 1e-4);
  // Row↑X(단축 W), Bay↑Z(장축 D)
  if (depth >= width) {
    return {
      origin: [x0, y, z0] as Vec3,
      sizeX: width,
      sizeZ: depth,
      yaw: 0,
    };
  }
  return {
    origin: [x0, y, z1] as Vec3,
    sizeX: depth,
    sizeZ: width,
    yaw: Math.PI / 2,
  };
}

function groupSlotRuns(lines: number[], slotsPerBlock: number) {
  if (lines.length < 2) return [];
  const gaps = lines.slice(1).map((line, i) => line - lines[i]!);
  const small = aisleThreshold(gaps) / 2.2;
  const aisle = Math.max(small * 2.2, 1e-6);
  const spans: { start: number; end: number }[] = [];
  let i = 0;
  while (i < gaps.length) {
    if (gaps[i]! > aisle) {
      i += 1;
      continue;
    }
    const startIndex = i;
    let taken = 0;
    while (i < gaps.length && gaps[i]! <= aisle && taken < slotsPerBlock) {
      taken += 1;
      i += 1;
    }
    spans.push({ start: lines[startIndex]!, end: lines[i]! });
  }
  return spans;
}

function cellsFromSpans(
  xSpans: { start: number; end: number }[],
  zSpans: { start: number; end: number }[],
  y: number,
  span: number,
  label: string,
) {
  const cells: Candidate[] = [];
  let index = 1;
  for (const zSpan of zSpans) {
    for (const xSpan of xSpans) {
      const width = xSpan.end - xSpan.start;
      const depth = zSpan.end - zSpan.start;
      if (width < span * 0.008 || depth < span * 0.008) continue;
      const aspect = Math.max(width, depth) / Math.min(width, depth);
      if (aspect < 3.5 || aspect > 24) continue;
      cells.push({
        label: `${label}#${index}`,
        ...orientedFromAABB(xSpan.start, xSpan.end, zSpan.start, zSpan.end, y),
      });
      index += 1;
    }
  }
  return cells;
}

function scoreBlockCells(cells: Candidate[]) {
  if (cells.length < 8 || cells.length > 80) return -1;
  return 80 - Math.abs(cells.length - 55);
}

function extractPaintedGrid(
  geometry: BufferGeometry,
  world: Matrix4,
  label: string,
): Candidate[] {
  const position = geometry.getAttribute("position");
  if (!position || position.count < 8) return [];

  const vertex = new Vector3();
  const xs: number[] = [];
  const zs: number[] = [];
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(world);
    xs.push(vertex.x);
    zs.push(vertex.z);
    maxY = Math.max(maxY, vertex.y);
    minX = Math.min(minX, vertex.x);
    maxX = Math.max(maxX, vertex.x);
    minZ = Math.min(minZ, vertex.z);
    maxZ = Math.max(maxZ, vertex.z);
  }

  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const xLines = cluster1D(xs, span * 0.0015);
  const zLines = cluster1D(zs, span * 0.0015);
  const layouts = [
    [spansFromLines(xLines), spansFromLines(zLines)],
    [
      groupSlotRuns(xLines, SLOT_MAX_SIZE.rows),
      groupSlotRuns(zLines, SLOT_MAX_SIZE.bays),
    ],
    [
      groupSlotRuns(xLines, SLOT_MAX_SIZE.bays),
      groupSlotRuns(zLines, SLOT_MAX_SIZE.rows),
    ],
  ] as const;

  let best: Candidate[] = [];
  let bestScore = -1;
  for (const [xSpans, zSpans] of layouts) {
    if (xSpans.length === 0 || zSpans.length === 0) continue;
    const cells = cellsFromSpans(xSpans, zSpans, maxY, span, label);
    const score = scoreBlockCells(cells);
    if (score > bestScore) {
      best = cells;
      bestScore = score;
    }
  }
  return best;
}

function collectLimitLineBlocks(root: Object3D): Candidate[] {
  const found: Candidate[] = [];
  root.traverse((child) => {
    if (!hasGeometry(child)) return;
    if (!namesOf(child).some(isLimitLineName)) return;
    if (isInstanced(child)) return;
    found.push(
      ...extractPaintedGrid(
        child.geometry,
        child.matrixWorld,
        child.name || "LimitLine",
      ),
    );
  });
  return found;
}

function isPlausibleBlockSet(items: Candidate[]) {
  return items.length >= 8 && items.length <= 80;
}

function filterSimilarFootprints(items: Candidate[]) {
  if (items.length < 2) return items;
  const areas = items
    .map((item) => item.sizeX * item.sizeZ)
    .sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)]!;
  return items.filter((item) => {
    const area = item.sizeX * item.sizeZ;
    return area >= median * 0.4 && area <= median * 2.5;
  });
}

function toBlockDefinition(
  label: string,
  origin: Vec3,
  sizeX: number,
  sizeZ: number,
  yaw: number,
  code: string,
): BlockDefinition {
  const fullRows = Math.max(1, Math.floor(sizeX / CONTAINER_W + 1e-6));
  const fullBays = Math.max(1, Math.floor(sizeZ / CONTAINER_D + 1e-6));
  const countX = Math.max(1, fullRows - 1);
  const countZ = Math.max(1, fullBays - 3);
  const rowPitch = sizeX / fullRows;
  const bayPitch = sizeZ / fullBays;
  const padX = (sizeX - countX * rowPitch) / 2;
  const topGap = bayPitch * 0.15;
  const padZ = topGap;

  return {
    code,
    name: label || code,
    origin,
    yaw,
    sizeX,
    sizeZ,
    rows: countX,
    bays: countZ,
    tiers: SLOT_MAX_SIZE.tiers,
    rowPitch,
    bayPitch,
    padX,
    padZ,
  };
}

type Candidate = {
  label: string;
  origin: Vec3;
  sizeX: number;
  sizeZ: number;
  yaw: number;
};

function pushMesh(
  object: Mesh,
  world: Matrix4,
  label: string,
  into: Candidate[],
) {
  const measured = measureFootprint(object.geometry, world);
  into.push({ label, ...measured });
}

/**
 * Ground GLB의 BLOCK 메시(및 GPU 인스턴스) footprint를 블록으로 추출한다.
 */
export function extractGroundBlocks(root: Object3D): BlockDefinition[] {
  root.updateMatrixWorld(true);

  const named: Candidate[] = [];
  const instancedParents = new Set<Object3D>();
  const world = new Matrix4();
  const instance = new Matrix4();

  const collect = (into: Candidate[]) => {
    instancedParents.clear();
    root.traverse((child) => {
      if (child === root) return;
      if (isFloorPlaneObject(child)) return;
      if (!objectIsBlock(child)) return;

      const label =
        namesOf(child).find((name) => name && isBlockName(name)) ||
        child.name ||
        "BLOCK";

      if (isInstanced(child)) {
        const parent = child.parent ?? child;
        if (instancedParents.has(parent)) return;
        instancedParents.add(parent);
        for (let i = 0; i < child.count; i += 1) {
          child.getMatrixAt(i, instance);
          world.multiplyMatrices(child.matrixWorld, instance);
          pushMesh(child, world.clone(), `${label}#${i + 1}`, into);
        }
        return;
      }

      if (hasGeometry(child)) {
        pushMesh(child, child.matrixWorld, label, into);
        return;
      }

      let hasMeshChild = false;
      child.traverse((node) => {
        if (node !== child && isMesh(node)) hasMeshChild = true;
      });
      if (hasMeshChild) return;

      const box = new Box3().setFromObject(child);
      if (box.isEmpty()) {
        const origin = new Vector3().setFromMatrixPosition(child.matrixWorld);
        into.push({
          label,
          ...orientedFromAABB(
            origin.x,
            origin.x + CONTAINER_W,
            origin.z,
            origin.z + CONTAINER_D,
            origin.y,
          ),
        });
        return;
      }
      into.push({
        label,
        ...orientedFromAABB(
          box.min.x,
          box.max.x,
          box.min.z,
          box.max.z,
          box.max.y,
        ),
      });
    });
  };

  const paintedRaw = collectLimitLineBlocks(root);
  collect(named);
  const namedUsable = named.filter((item) => {
    const area = item.sizeX * item.sizeZ;
    return area > CONTAINER_W * CONTAINER_D * 4;
  });

  const painted = filterSimilarFootprints(paintedRaw);
  const found = isPlausibleBlockSet(namedUsable)
    ? namedUsable
    : isPlausibleBlockSet(painted)
      ? painted
      : namedUsable.length > 0
        ? namedUsable
        : painted;

  if (import.meta.env.DEV) {
    const source = isPlausibleBlockSet(namedUsable)
      ? "named"
      : isPlausibleBlockSet(painted)
        ? "LimitLine"
        : namedUsable.length > 0
          ? "named"
          : "none";
    console.info(
      `[Ground] blocks source=${source} ` +
        `limitLine=${paintedRaw.length}→${painted.length} named=${namedUsable.length}`,
    );
  }

  const used = new Set<string>();
  const blocks: BlockDefinition[] = [];
  const sorted = [...found].sort((a, b) => {
    if (Math.abs(a.origin[2] - b.origin[2]) > 0.01)
      return a.origin[2] - b.origin[2];
    return a.origin[0] - b.origin[0];
  });

  let sequential = 1;
  for (const item of sorted) {
    const parsed = parseBlockCode(item.label);
    let code = parsed;
    if (!code || used.has(code)) {
      while (used.has(`B${String(sequential).padStart(2, "0")}`))
        sequential += 1;
      code = `B${String(sequential).padStart(2, "0")}`;
      sequential += 1;
    }
    used.add(code);

    blocks.push(
      toBlockDefinition(
        item.label,
        item.origin,
        item.sizeX,
        item.sizeZ,
        item.yaw,
        code,
      ),
    );
  }

  return blocks;
}

export function listObjectNames(root: Object3D): string[] {
  const names: string[] = [];
  root.traverse((child) => {
    for (const name of namesOf(child)) {
      if (name) names.push(name);
    }
    if (isInstanced(child)) {
      names.push(`${child.name || "(instanced)"}×${child.count}`);
    }
  });
  return [...new Set(names)];
}
