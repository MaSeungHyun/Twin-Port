import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";

let bound: ShipInstance[] | null = null;

export function bindShipPoses(poses: ShipInstance[] | null) {
  bound = poses;
}

export type ShipWakeSample = {
  index: number;
  x: number;
  z: number;
  yaw: number;
  scale: number;
};

export function getShipPoseAt(index: number): ShipInstance | null {
  return bound?.[index] ?? null;
}

export function forEachShip(fn: (ship: ShipWakeSample) => void) {
  if (!bound) return;
  for (let i = 0; i < bound.length; i++) {
    const ship = bound[i];
    const position = ship?.position;
    if (!position) continue;
    const scale = ship.scale;
    fn({
      index: i,
      x: position[0],
      z: position[2],
      yaw: ship.rotation?.[1] ?? 0,
      scale: typeof scale === "number" ? scale : (scale?.[0] ?? 1),
    });
  }
}
