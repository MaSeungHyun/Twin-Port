import { type ThreeEvent } from "@react-three/fiber";
import {
  InstancedMesh,
  Mesh,
  type BufferGeometry,
  type Object3D,
} from "three";

export type PortHoverKind = "ship" | "overheadCrane" | "quayCrane";

export type PortHover = {
  kind: PortHoverKind;
  id: string;
} | null;

let currentHover: PortHover = null;
let clearToken = 0;
const listeners = new Set<() => void>();

function notifyHover() {
  for (const listener of listeners) listener();
}

export function getPortHover() {
  return currentHover;
}

export function subscribePortHover(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setPortHover(next: PortHover) {
  const prev = currentHover;
  if (prev?.kind === next?.kind && prev?.id === next?.id) return;
  currentHover = next;
  notifyHover();
}

export function hoveredIndexOf(kind: PortHoverKind) {
  const hover = currentHover;
  if (hover?.kind !== kind) return -1;
  const index = Number(hover.id);
  return Number.isInteger(index) ? index : -1;
}

export function portHoverOver(
  event: ThreeEvent<PointerEvent>,
  kind: PortHoverKind,
  id: string | null,
) {
  if (id == null) return;
  event.stopPropagation();
  clearToken += 1;
  setPortHover({ kind, id });
}

export function portHoverOut(
  event: ThreeEvent<PointerEvent>,
  kind: PortHoverKind,
  id: string | null,
) {
  if (id == null) return;
  event.stopPropagation();
  const token = ++clearToken;
  const snapshot = { kind, id };
  requestAnimationFrame(() => {
    if (token !== clearToken) return;
    const hover = currentHover;
    if (hover?.kind === snapshot.kind && hover.id === snapshot.id) {
      setPortHover(null);
    }
  });
}

export function instanceHoverId(event: ThreeEvent<PointerEvent>) {
  return event.instanceId == null ? null : String(event.instanceId);
}

function namesOf(object: Object3D) {
  const mesh = object as Mesh;
  return [
    object.name,
    object.parent?.name ?? "",
    mesh.isMesh ? (mesh.geometry?.name ?? "") : "",
  ];
}

function looksLikeQuayCrane(object: Object3D) {
  return namesOf(object).some(
    (name) => /crane|kran/i.test(name) && !/overhead/i.test(name),
  );
}

export function findQuayCraneRoot(object: Object3D): Object3D | null {
  if ((object as InstancedMesh).isInstancedMesh && looksLikeQuayCrane(object)) {
    return object;
  }
  let node: Object3D | null = object;
  while (node) {
    if (looksLikeQuayCrane(node)) {
      const parent = node.parent;
      if (parent && /^(crane|kran)(?!s\b)/i.test(parent.name)) return parent;
      return node;
    }
    node = node.parent;
  }
  return null;
}

export type QuayHoverTarget = {
  rootId: string;
  source: Mesh;
  geometry: BufferGeometry;
};

export function collectQuayHoverTargets(model: Object3D): QuayHoverTarget[] {
  const seen = new Set<Mesh>();
  const targets: QuayHoverTarget[] = [];

  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (child.name.endsWith("-occupancy")) return;
    const root = findQuayCraneRoot(child);
    if (!root || seen.has(child)) return;
    seen.add(child);
    targets.push({
      rootId: root.uuid,
      source: child,
      geometry: child.geometry,
    });
  });

  return targets;
}

export function writeQuayOutlineMatrix(target: QuayHoverTarget, dest: Mesh) {
  const hover = currentHover;
  const instanceId =
    hover?.kind === "quayCrane" && hover.id.includes(":")
      ? Number(hover.id.slice(hover.id.indexOf(":") + 1))
      : undefined;

  dest.matrixAutoUpdate = false;
  if (
    target.source instanceof InstancedMesh &&
    Number.isInteger(instanceId)
  ) {
    target.source.getMatrixAt(instanceId!, dest.matrix);
    dest.matrix.premultiply(target.source.matrixWorld);
  } else {
    dest.matrix.copy(target.source.matrixWorld);
  }
  dest.matrixWorldNeedsUpdate = true;
}

export function quayTargetMatches(target: QuayHoverTarget, hoverId: string) {
  if (target.rootId === hoverId || target.source.uuid === hoverId) return true;
  const colon = hoverId.indexOf(":");
  if (colon === -1) return false;
  const uuid = hoverId.slice(0, colon);
  return uuid === target.rootId || uuid === target.source.uuid;
}

/** Ground deck 등은 통과시키고 quay crane만 포인터 hit (Block hover raycast 복구) */
export function applyGroundPointerFilter(model: Object3D) {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (child.name.endsWith("-occupancy") || !findQuayCraneRoot(child)) {
      child.raycast = () => null;
    }
  });
}
