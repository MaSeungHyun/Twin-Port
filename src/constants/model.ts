import type { CraneInstance } from "@/views/viewport/_components/Port/Crane";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";

export const SHIP_SCALE = 0.5;
export const CRANE_SCALE = 0.5;
export const SHIP_POSITION_Y = -4.3;

const YAW_180: [number, number, number] = [0, Math.PI, 0];
const SHIP_ROATION: [number, number, number] = [0, Math.PI / 2, 0];

export const SHIP_INSTANCES: ShipInstance[] = [
  {
    position: [70, SHIP_POSITION_Y, 80],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
  {
    position: [70, SHIP_POSITION_Y, 15],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
  {
    position: [70, SHIP_POSITION_Y, -60],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
  {
    position: [-70, SHIP_POSITION_Y, 80],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
  {
    position: [-70, SHIP_POSITION_Y, 15],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
  {
    position: [-70, SHIP_POSITION_Y, -60],
    rotation: SHIP_ROATION,
    scale: SHIP_SCALE,
  },
];

export const CRANE_INSTANCES: CraneInstance[] = [
  { position: [50, 0, 70], scale: CRANE_SCALE },
  { position: [50, 0, 80], scale: CRANE_SCALE },
  { position: [50, 0, 90], scale: CRANE_SCALE },

  { position: [-55, 0, 70], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 80], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 90], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [50, 0, 0], scale: CRANE_SCALE },
  { position: [50, 0, 10], scale: CRANE_SCALE },
  { position: [50, 0, 20], scale: CRANE_SCALE },

  { position: [-55, 0, 0], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 10], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, 20], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [50, 0, -50], scale: CRANE_SCALE },
  { position: [50, 0, -60], scale: CRANE_SCALE },
  { position: [50, 0, -70], scale: CRANE_SCALE },

  { position: [-55, 0, -50], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, -60], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-55, 0, -70], rotation: YAW_180, scale: CRANE_SCALE },
];
