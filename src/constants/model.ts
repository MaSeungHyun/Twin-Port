import type { CraneInstance } from "@/views/viewport/_components/Port/Crane";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";

export const SHIP_SCALE = 0.5;
export const CRANE_SCALE = 0.5;
export const SHIP_Y = 0.3;

const YAW_180: [number, number, number] = [0, Math.PI, 0];

export const SHIP_INSTANCES: ShipInstance[] = [
  { position: [65, SHIP_Y, 80], scale: SHIP_SCALE },
  { position: [65, SHIP_Y, 20], scale: SHIP_SCALE },
  { position: [65, SHIP_Y, -50], scale: SHIP_SCALE },
  { position: [-65, SHIP_Y, 80], rotation: YAW_180, scale: SHIP_SCALE },
  { position: [-65, SHIP_Y, 20], rotation: YAW_180, scale: SHIP_SCALE },
  { position: [-65, SHIP_Y, -50], rotation: YAW_180, scale: SHIP_SCALE },
];

export const CRANE_INSTANCES: CraneInstance[] = [
  { position: [50, 0, 70], scale: CRANE_SCALE },
  { position: [50, 0, 80], scale: CRANE_SCALE },
  { position: [50, 0, 90], scale: CRANE_SCALE },
  { position: [-55, 0, 70], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 80], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 90], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [50, 0, 20], scale: CRANE_SCALE },
  { position: [50, 0, 10], scale: CRANE_SCALE },
  { position: [50, 0, 30], scale: CRANE_SCALE },
  { position: [-55, 0, 20], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 10], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 30], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [50, 0, -50], scale: CRANE_SCALE },
  { position: [50, 0, -60], scale: CRANE_SCALE },
  { position: [50, 0, -70], scale: CRANE_SCALE },
  { position: [-55, 0, -50], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, -60], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, -70], rotation: YAW_180, scale: CRANE_SCALE },
];
