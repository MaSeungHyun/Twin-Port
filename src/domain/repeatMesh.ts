/**
 * [repeat] Fence / MeshedRoad / MeshedLimitedLine 은 구간이 반복인데 통째로 한 메시라
 * 화면 밖 구간도 같이 그려진다. 같은 모양은 한 geometry 로 인스턴스하고, 약 240m 칸으로 나눠
 * 프러스텀 밖에서 빠지게 한다. 모양이 어긋나는 구간은 삼각형을 그대로 둔다.
 */
import { loadSpan } from "@/debug/loadTiming";
import {
  GROUND_LOD_HYSTERESIS,
  GROUND_LOD_LEVELS,
  GROUND_LOD_MIN_TRIANGLES,
} from "@/constants/groundLod";
import { simplifiedGeometriesAsync, triangleCount } from "@/domain/craneLod";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type Camera,
  type Material,
  type Object3D,
} from "three";

const CELL = 240;
const RUN_ERROR = 0.03;
const TILE_ERROR = 0.015;
const UV_ERROR = 0.03;
const CELL_SIZE = 0.2;
/** 비교용 점 간격. 3cm 허용보다 촘촘해서 슬랫이 다른 구간은 걸러지고, 점 개수는 줄어든다. */
const MATCH_QUANT = 0.02;

type Axis = "x" | "z";
type Part = {
  corners: Uint32Array;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  cx: number;
  cz: number;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  local: Float32Array;
  uv: Float32Array | null;
};

type Kind = "run" | "tile";

function kindOf(mesh: Mesh): Kind | null {
  const name = `${mesh.name} ${mesh.parent?.name ?? ""}`;
  if (/fence/i.test(name)) return "run";
  if (/meshedroad|meshedlimitedline/i.test(name)) return "tile";
  return null;
}

function downsample(local: Float32Array, uv: Float32Array | null) {
  const seen = new Set<string>();
  const out: number[] = [];
  const uo: number[] = [];
  for (let i = 0; i < local.length; i += 3) {
    const key = `${Math.round(local[i]! / MATCH_QUANT)},${Math.round(local[i + 1]! / MATCH_QUANT)},${Math.round(local[i + 2]! / MATCH_QUANT)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(local[i]!, local[i + 1]!, local[i + 2]!);
    if (uv) {
      const v = i / 3;
      uo.push(uv[v * 2]!, uv[v * 2 + 1]!);
    }
  }
  return { local: Float32Array.from(out), uv: uv ? Float32Array.from(uo) : null };
}

function attrOK(attr: unknown): attr is BufferAttribute {
  return !!attr && !(attr as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute;
}

function extractParts(geo: BufferGeometry): Part[] | null {
  const pos = geo.getAttribute("position");
  if (!attrOK(pos) || pos.itemSize !== 3) return null;
  const uvAttr = geo.getAttribute("uv");
  const uv = attrOK(uvAttr) && uvAttr.itemSize === 2 ? uvAttr : null;
  const index = geo.getIndex();
  const verts = pos.count;
  const triCount = Math.floor((index ? index.count : verts) / 3);
  const parent = new Uint32Array(verts);
  for (let i = 0; i < verts; i++) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!;
      a = parent[a]!;
    }
    return a;
  };
  const uni = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < triCount; t++) {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);
    uni(a, b);
    uni(b, c);
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < triCount; t++) {
    const r = find(corner(t, 0));
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(t);
  }
  const parts: Part[] = [];
  for (const tris of groups.values()) {
    const seen = new Map<number, number>();
    const corners = new Uint32Array(tris.length * 3);
    const local: number[] = [];
    const uvs: number[] = [];
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const use = (vi: number) => {
      let k = seen.get(vi);
      if (k == null) {
        const x = pos.getX(vi);
        const y = pos.getY(vi);
        const z = pos.getZ(vi);
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
        k = local.length / 3;
        seen.set(vi, k);
        local.push(x, y, z);
        if (uv) uvs.push(uv.getX(vi), uv.getY(vi));
      }
      return k;
    };
    tris.forEach((t, i) => {
      corners[i * 3] = corner(t, 0);
      corners[i * 3 + 1] = corner(t, 1);
      corners[i * 3 + 2] = corner(t, 2);
      use(corners[i * 3]!);
      use(corners[i * 3 + 1]!);
      use(corners[i * 3 + 2]!);
    });
    const rel = new Float32Array(local.length);
    for (let i = 0; i < local.length; i += 3) {
      rel[i] = local[i]! - minX;
      rel[i + 1] = local[i + 1]! - minY;
      rel[i + 2] = local[i + 2]! - minZ;
    }
    const sampled = downsample(rel, uv ? Float32Array.from(uvs) : null);
    parts.push({
      corners,
      minX, minY, minZ, maxX, maxY, maxZ,
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      anchorX: minX, anchorY: minY, anchorZ: minZ,
      local: sampled.local,
      uv: sampled.uv,
    });
  }
  return parts;
}

function linesAlong(parts: Part[], axis: Axis): { parts: Part[]; axis: Axis }[] {
  const longs = parts.filter((p) => {
    const sx = p.maxX - p.minX;
    const sz = p.maxZ - p.minZ;
    const long = axis === "x" ? sx : sz;
    const short = axis === "x" ? sz : sx;
    return long > 4 && long > short * 3;
  });
  longs.sort((a, b) => (axis === "x" ? a.cz - b.cz : a.cx - b.cx));
  const lines: { parts: Part[]; sum: number }[] = [];
  for (const p of longs) {
    const perp = axis === "x" ? p.cz : p.cx;
    const last = lines[lines.length - 1];
    if (last && Math.abs(perp - last.sum / last.parts.length) <= 2) {
      last.parts.push(p);
      last.sum += perp;
      continue;
    }
    lines.push({ parts: [p], sum: perp });
  }
  const out: { parts: Part[]; axis: Axis }[] = [];
  for (const line of lines) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of line.parts) {
      min = Math.min(min, axis === "x" ? p.minX : p.minZ);
      max = Math.max(max, axis === "x" ? p.maxX : p.maxZ);
    }
    if (max - min > 40 && line.parts.length >= 6) out.push({ parts: line.parts, axis });
  }
  return out;
}

function periodOf(line: Part[], axis: Axis): { origin: number; period: number } | null {
  const starts = line.map((p) => (axis === "x" ? p.minX : p.minZ)).sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const s of starts) if (!uniq.length || s - uniq[uniq.length - 1]! > 0.45) uniq.push(s);
  const gaps: { g: number; at: number }[] = [];
  for (let i = 1; i < uniq.length; i++) {
    const g = uniq[i]! - uniq[i - 1]!;
    if (g >= 3 && g <= 45) gaps.push({ g, at: i - 1 });
  }
  if (gaps.length < 8) return null;
  const hist = new Map<number, number>();
  for (const { g } of gaps) {
    const bucket = Math.round(g * 10) / 10;
    hist.set(bucket, (hist.get(bucket) ?? 0) + 1);
  }
  let mode = 0;
  let modeN = 0;
  for (const [bucket, n] of hist) if (n > modeN) { mode = bucket; modeN = n; }
  const near = gaps.filter((item) => Math.abs(item.g - mode) <= 0.15);
  if (near.length < gaps.length * 0.35) return null;
  const periods = near.map((item) => item.g).sort((a, b) => a - b);
  let bestRun = 0;
  let bestAt = near[0]!.at;
  let run = 0;
  let runAt = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (Math.abs(gaps[i]!.g - mode) <= 0.15) {
      if (run === 0) runAt = gaps[i]!.at;
      run++;
      if (run > bestRun) { bestRun = run; bestAt = runAt; }
    } else run = 0;
  }
  return { origin: uniq[bestAt]!, period: periods[periods.length >> 1]! };
}

function cloud(geo: BufferGeometry, corners: Uint32Array, ax: number, ay: number, az: number) {
  const pos = geo.getAttribute("position");
  const uvAttr = geo.getAttribute("uv");
  const uv = attrOK(uvAttr) && uvAttr.itemSize === 2 ? uvAttr : null;
  const seen = new Set<number>();
  const local: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const vi = corners[i]!;
    if (seen.has(vi)) continue;
    seen.add(vi);
    local.push(pos.getX(vi) - ax, pos.getY(vi) - ay, pos.getZ(vi) - az);
    if (uv) uvs.push(uv.getX(vi), uv.getY(vi));
  }
  return { local: Float32Array.from(local), uv: uv ? Float32Array.from(uvs) : null };
}

function makeBay(geo: BufferGeometry, members: Part[], axis: Axis): Part {
  let n = 0;
  for (const p of members) n += p.corners.length;
  const corners = new Uint32Array(n);
  let o = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumPerp = 0;
  let minAlong = Infinity;
  for (const p of members) {
    corners.set(p.corners, o);
    o += p.corners.length;
    minX = Math.min(minX, p.minX); minY = Math.min(minY, p.minY); minZ = Math.min(minZ, p.minZ);
    maxX = Math.max(maxX, p.maxX); maxY = Math.max(maxY, p.maxY); maxZ = Math.max(maxZ, p.maxZ);
    sumPerp += axis === "x" ? p.cz : p.cx;
    minAlong = Math.min(minAlong, axis === "x" ? p.minX : p.minZ);
  }
  const perp = sumPerp / members.length;
  const anchorX = axis === "x" ? minAlong : perp;
  const anchorZ = axis === "x" ? perp : minAlong;
  const sampled = cloud(geo, corners, anchorX, minY, anchorZ);
  const built = downsample(sampled.local, sampled.uv);
  return {
    corners,
    minX, minY, minZ, maxX, maxY, maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    anchorX, anchorY: minY, anchorZ,
    local: built.local,
    uv: built.uv,
  };
}

function buildBays(geo: BufferGeometry, parts: Part[]): { bays: Part[]; rest: Part[] } {
  const used = new Set<Part>();
  const bays: Part[] = [];
  const lines = [...linesAlong(parts, "x"), ...linesAlong(parts, "z")];
  lines.sort((a, b) => {
    const span = (line: { parts: Part[]; axis: Axis }) => {
      let min = Infinity, max = -Infinity;
      for (const p of line.parts) {
        min = Math.min(min, line.axis === "x" ? p.minX : p.minZ);
        max = Math.max(max, line.axis === "x" ? p.maxX : p.maxZ);
      }
      return max - min;
    };
    return span(b) - span(a);
  });
  for (const line of lines) {
    const spec = periodOf(line.parts, line.axis);
    if (!spec) continue;
    let perpMin = Infinity, perpMax = -Infinity, alongMin = Infinity, alongMax = -Infinity;
    for (const p of line.parts) {
      const perp = line.axis === "x" ? p.cz : p.cx;
      perpMin = Math.min(perpMin, perp);
      perpMax = Math.max(perpMax, perp);
      alongMin = Math.min(alongMin, line.axis === "x" ? p.minX : p.minZ);
      alongMax = Math.max(alongMax, line.axis === "x" ? p.maxX : p.maxZ);
    }
    perpMin -= 1;
    perpMax += 1;
    alongMin -= spec.period;
    alongMax += spec.period;
    const slots = new Map<number, Part[]>();
    for (const p of parts) {
      if (used.has(p)) continue;
      const perp = line.axis === "x" ? p.cz : p.cx;
      const along = line.axis === "x" ? p.cx : p.cz;
      if (perp < perpMin || perp > perpMax || along < alongMin || along > alongMax) continue;
      const slot = Math.floor((along - spec.origin) / spec.period);
      let g = slots.get(slot);
      if (!g) slots.set(slot, (g = []));
      g.push(p);
    }
    for (const group of slots.values()) {
      let corners = 0;
      for (const p of group) corners += p.corners.length;
      if (corners < 90) continue;
      for (const p of group) used.add(p);
      bays.push(makeBay(geo, group, line.axis));
    }
  }
  return { bays, rest: parts.filter((p) => !used.has(p)) };
}

function gridOf(part: Part) {
  const map = new Map<string, number[]>();
  const p = part.local;
  for (let i = 0; i < p.length; i += 3) {
    const key = `${Math.round(p[i]! / CELL_SIZE)},${Math.round(p[i + 1]! / CELL_SIZE)},${Math.round(p[i + 2]! / CELL_SIZE)}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = []));
    g.push(i);
  }
  return map;
}

function cover(src: Part, dst: Part, grid: Map<string, number[]>, error: number, uvError: number) {
  const err2 = error * error;
  const uv2 = uvError * uvError;
  const sp = src.local;
  const dp = dst.local;
  const su = src.uv;
  const du = dst.uv;
  const checkUv = !!(su && du);
  for (let i = 0; i < sp.length; i += 3) {
    const x = sp[i]!;
    const y = sp[i + 1]!;
    const z = sp[i + 2]!;
    const cx = Math.round(x / CELL_SIZE);
    const cy = Math.round(y / CELL_SIZE);
    const cz = Math.round(z / CELL_SIZE);
    let best = Infinity;
    let ui = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const j of bucket) {
            const ddx = dp[j]! - x;
            const ddy = dp[j + 1]! - y;
            const ddz = dp[j + 2]! - z;
            const d = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d < best) {
              best = d;
              ui = j / 3;
            }
          }
        }
      }
    }
    if (best > err2) return false;
    if (checkUv && su && du) {
      const s = i / 3;
      const ddu = su[s * 2]! - du[ui * 2]!;
      const ddv = su[s * 2 + 1]! - du[ui * 2 + 1]!;
      if (ddu * ddu + ddv * ddv > uv2) return false;
    }
  }
  return true;
}

function clusterParts(parts: Part[], error: number, uvError: number): Part[][] {
  const groups: Part[][] = [];
  const protos: Part[] = [];
  const grids: Map<string, number[]>[] = [];
  const sorted = [...parts].sort((a, b) => b.corners.length - a.corners.length);
  for (const part of sorted) {
    const pv = part.local.length / 3;
    const partGrid = gridOf(part);
    const sx = part.maxX - part.minX;
    const sy = part.maxY - part.minY;
    const sz = part.maxZ - part.minZ;
    let hit = -1;
    for (let i = 0; i < protos.length; i++) {
      const proto = protos[i]!;
      const qv = proto.local.length / 3;
      if (Math.abs(pv - qv) > Math.max(24, qv * 0.35)) continue;
      if (
        Math.abs(sx - (proto.maxX - proto.minX)) > error * 4 ||
        Math.abs(sy - (proto.maxY - proto.minY)) > error * 4 ||
        Math.abs(sz - (proto.maxZ - proto.minZ)) > error * 4
      ) continue;
      if (cover(part, proto, grids[i]!, error, uvError) && cover(proto, part, partGrid, error, uvError)) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) groups[hit]!.push(part);
    else {
      protos.push(part);
      grids.push(gridOf(part));
      groups.push([part]);
    }
  }
  return groups;
}

function cellKey(x: number, z: number) {
  return `${Math.floor(x / CELL)}_${Math.floor(z / CELL)}`;
}

function compact(geo: BufferGeometry, corners: ArrayLike<number>, anchorX = 0, anchorY = 0, anchorZ = 0) {
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  const hasN = attrOK(nrm) && nrm.itemSize === 3;
  const hasU = attrOK(uv) && uv.itemSize === 2;
  const map = new Map<number, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const vi = corners[i]!;
    let k = map.get(vi);
    if (k == null) {
      k = positions.length / 3;
      map.set(vi, k);
      positions.push(pos.getX(vi) - anchorX, pos.getY(vi) - anchorY, pos.getZ(vi) - anchorZ);
      if (hasN && nrm) normals.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
      if (hasU && uv) uvs.push(uv.getX(vi), uv.getY(vi));
    }
    index.push(k);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(Float32Array.from(positions), 3));
  if (hasN) g.setAttribute("normal", new BufferAttribute(Float32Array.from(normals), 3));
  else g.computeVertexNormals();
  if (hasU) g.setAttribute("uv", new BufferAttribute(Float32Array.from(uvs), 2));
  g.setIndex(new BufferAttribute(Uint32Array.from(index), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function attachLike(source: Mesh, created: Mesh) {
  created.name = source.name;
  created.position.copy(source.position);
  created.quaternion.copy(source.quaternion);
  created.scale.copy(source.scale);
  created.castShadow = source.castShadow;
  created.receiveShadow = source.receiveShadow;
  created.renderOrder = source.renderOrder;
  created.visible = source.visible;
  created.layers.mask = source.layers.mask;
  created.frustumCulled = true;
  created.raycast = () => null;
  created.matrixAutoUpdate = source.matrixAutoUpdate;
  if (!source.matrixAutoUpdate) created.matrix.copy(source.matrix);
  created.userData.groundLod = true;
}

function emitInstances(geo: BufferGeometry, proto: Part, members: Part[], material: Material | Material[], source: Mesh) {
  const buckets = new Map<string, Part[]>();
  for (const member of members) {
    const key = cellKey(member.cx, member.cz);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push(member);
  }
  const geometry = compact(geo, proto.corners, proto.anchorX, proto.anchorY, proto.anchorZ);
  const meshes: Mesh[] = [];
  const matrix = new Matrix4();
  for (const group of buckets.values()) {
    const inst = new InstancedMesh(geometry, material, group.length);
    group.forEach((member, i) => {
      // geometry 는 proto 앵커를 뺀 좌표. 인스턴스 위치 = 그 구간의 앵커.
      matrix.makeTranslation(member.anchorX, member.anchorY, member.anchorZ);
      inst.setMatrixAt(i, matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    attachLike(source, inst);
    meshes.push(inst);
  }
  return meshes;
}

function emitUnique(geo: BufferGeometry, parts: Part[], material: Material | Material[], source: Mesh) {
  const pos = geo.getAttribute("position");
  const buckets = new Map<string, number[]>();
  for (const part of parts) {
    const c = part.corners;
    for (let i = 0; i < c.length; i += 3) {
      const ax = (pos.getX(c[i]!) + pos.getX(c[i + 1]!) + pos.getX(c[i + 2]!)) / 3;
      const az = (pos.getZ(c[i]!) + pos.getZ(c[i + 1]!) + pos.getZ(c[i + 2]!)) / 3;
      const key = cellKey(ax, az);
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = []));
      bucket.push(c[i]!, c[i + 1]!, c[i + 2]!);
    }
  }
  const meshes: Mesh[] = [];
  for (const corners of buckets.values()) {
    const mesh = new Mesh(compact(geo, corners), material);
    attachLike(source, mesh);
    meshes.push(mesh);
  }
  return meshes;
}

function cornerCount(parts: Part[]) {
  let n = 0;
  for (const p of parts) n += p.corners.length;
  return n;
}

function optimizeMesh(mesh: Mesh, kind: Kind): Mesh[] | null {
  const geo = mesh.geometry;
  if (!geo || (geo.morphAttributes && Object.keys(geo.morphAttributes).length > 0)) return null;
  const parts = extractParts(geo);
  if (!parts || parts.length < 2) return null;
  const total = cornerCount(parts);
  if (total < 8000 * 3) return null;
  const error = kind === "run" ? RUN_ERROR : TILE_ERROR;
  let repeated: Part[][] = [];
  let unique: Part[] = [];
  if (kind === "run") {
    const { bays, rest } = buildBays(geo, parts);
    if (cornerCount(bays) + cornerCount(rest) !== total) return null;
    const grouped = clusterParts(bays, error, UV_ERROR);
    unique = [...rest];
    for (const g of grouped) {
      const tris = g[0]!.corners.length / 3;
      if (g.length >= 2 && tris * g.length >= 80) repeated.push(g);
      else unique.push(...g);
    }
  } else {
    const grouped = clusterParts(parts, error, UV_ERROR);
    for (const g of grouped) {
      const tris = g[0]!.corners.length / 3;
      if (g.length >= 2 && tris * g.length >= 80) repeated.push(g);
      else unique.push(...g);
    }
  }
  if (cornerCount(unique) + repeated.reduce((s, g) => s + cornerCount(g), 0) !== total) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.minX); maxX = Math.max(maxX, p.maxX);
    minZ = Math.min(minZ, p.minZ); maxZ = Math.max(maxZ, p.maxZ);
  }
  if (repeated.length === 0 && Math.max(maxX - minX, maxZ - minZ) < CELL * 1.5) return null;
  const material = mesh.material;
  const created = unique.length ? emitUnique(geo, unique, material, mesh) : [];
  let instancedTris = 0;
  for (const g of repeated) {
    created.push(...emitInstances(geo, g[0]!, g, material, mesh));
    instancedTris += (g[0]!.corners.length / 3) * g.length;
  }
  if (!created.length) return null;
  if (import.meta.env?.DEV) {
    const label = mesh.parent?.name || mesh.name;
    console.info(
      `[repeat] ${label} 삼각형 ${Math.round(total / 3)} → 반복 ${instancedTris} (${repeated.length}종), 고유 ${Math.round(cornerCount(unique) / 3)}, 메시 ${created.length}`,
    );
  }
  return created;
}

function tagTetrapods(root: Object3D) {
  root.traverse((o) => {
    if (!(o instanceof Mesh) || (o as InstancedMesh).isInstancedMesh) return;
    if (/tetrapod/i.test(`${o.name} ${o.parent?.name ?? ""}`)) o.userData.groundLod = true;
  });
}

/** 클론된 지면 씬에서 fence / road / 차선을 반복 구간 인스턴스로 바꾼다. 실패하면 해당 메시는 원본 유지. */
export function instanceRepeatedGround(root: Object3D) {
  const targets: { mesh: Mesh; kind: Kind }[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || (o as InstancedMesh).isInstancedMesh) return;
    const kind = kindOf(o);
    if (kind) targets.push({ mesh: o, kind });
  });
  for (const { mesh, kind } of targets) {
    let created: Mesh[] | null = null;
    try {
      created = optimizeMesh(mesh, kind);
    } catch (e) {
      console.warn("[repeat] 실패, 원본 유지", mesh.name, e);
    }
    const parent = mesh.parent;
    if (!created || !parent) continue;
    for (const m of created) parent.add(m);
    mesh.removeFromParent();
  }
  tagTetrapods(root);
}

export type GroundLodSet = {
  entries: { mesh: Mesh; levels: BufferGeometry[]; current: number; box: Box3 }[];
  trianglesPerLevel: number[];
};

function worldBox(mesh: Mesh) {
  mesh.updateWorldMatrix(true, false);
  const inst = mesh as InstancedMesh;
  if (inst.isInstancedMesh) {
    if (!inst.boundingBox) inst.computeBoundingBox();
    return inst.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  }
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
}

function drawnTriangles(mesh: Mesh, geometry: BufferGeometry) {
  const count = (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).count : 1;
  return triangleCount(geometry) * count;
}

/** 펜스/도로/차선 청크의 거리 LOD. 같은 geometry 는 한 번만 단순화하고 청크가 공유한다. */
export async function buildGroundLods(root: Object3D): Promise<GroundLodSet> {
  const end = loadSpan("groundLod build");
  try {
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof Mesh && o.userData.groundLod) meshes.push(o);
    });
    const bases = new Set<BufferGeometry>();
    for (const mesh of meshes) bases.add(mesh.geometry);
    const cache = new Map<BufferGeometry, BufferGeometry[]>();
    await Promise.all(
      [...bases].map(async (base) => {
        const levels: BufferGeometry[] = [base];
        if (triangleCount(base) >= GROUND_LOD_MIN_TRIANGLES) {
          base.computeBoundingBox();
          base.computeBoundingSphere();
          const simplified = await simplifiedGeometriesAsync(base, GROUND_LOD_LEVELS, true);
          let prev = base;
          for (const g of simplified) {
            prev = g ?? prev;
            levels.push(prev);
          }
        } else {
          for (let i = 0; i < GROUND_LOD_LEVELS.length; i++) levels.push(base);
        }
        cache.set(base, levels);
      }),
    );
    const entries: GroundLodSet["entries"] = [];
    const trianglesPerLevel = new Array(GROUND_LOD_LEVELS.length + 1).fill(0);
    for (const mesh of meshes) {
      const levels = cache.get(mesh.geometry)!;
      levels.forEach((g, i) => (trianglesPerLevel[i] += drawnTriangles(mesh, g)));
      entries.push({ mesh, levels, current: 0, box: worldBox(mesh) });
    }
    return { entries, trianglesPerLevel };
  } finally {
    end();
  }
}

const _cam = new Vector3();

/** 카메라와 청크 박스 거리로 geometry 교체. 첫 단계는 거리 0이라 가까이서도 단순 메시. */
export function updateGroundLods(set: GroundLodSet, camera: Camera) {
  camera.getWorldPosition(_cam);
  let changed = 0;
  for (const entry of set.entries) {
    const d = entry.box.distanceToPoint(_cam);
    let level = 0;
    for (let i = 0; i < GROUND_LOD_LEVELS.length; i++) {
      const edge = GROUND_LOD_LEVELS[i]!.distance * (i + 1 <= entry.current ? 1 - GROUND_LOD_HYSTERESIS : 1);
      if (d >= edge) level = i + 1;
    }
    if (level === entry.current) continue;
    entry.current = level;
    entry.mesh.geometry = entry.levels[level]!;
    changed++;
  }
  return changed;
}

export function resetGroundLods(set: GroundLodSet) {
  for (const entry of set.entries) {
    entry.current = 0;
    entry.mesh.geometry = entry.levels[0]!;
  }
}
