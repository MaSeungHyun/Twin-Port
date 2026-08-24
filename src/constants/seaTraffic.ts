import { SHIP_POSITION_Y, SHIP_SCALE } from "./model";
import { yawToward } from "./shipCargo";

export type SeaTrafficShip = {
  /** 레인 Z (+Z 먼 바다) */
  z: number;
  /** X 항로 범위 */
  xMin: number;
  xMax: number;
  /** 시작 X */
  x: number;
  y: number;
  /** +1 = +X, -1 = -X */
  dir: 1 | -1;
  /** 월드 단위/초 */
  speed: number;
  scale: number;
  yaw: number;
};

function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** +Z 먼 바다를 가로지르는 화물선 7척 */
export function createSeaTrafficShips(count = 7): SeaTrafficShip[] {
  const ships: SeaTrafficShip[] = [];
  for (let i = 0; i < count; i++) {
    const a = hash01(i + 1);
    const b = hash01(i + 17);
    const c = hash01(i + 41);
    const d = hash01(i + 73);
    const dir: 1 | -1 = c > 0.5 ? 1 : -1;
    const xMin = -52;
    const xMax = 52;
    const x = xMin + a * (xMax - xMin);
    const z = 42 + b * 28;
    const speed = 0.7 + d * 1.1;

    ships.push({
      z,
      xMin,
      xMax,
      x,
      y: SHIP_POSITION_Y,
      dir,
      speed,
      scale: SHIP_SCALE,
      yaw: yawToward(dir, 0),
    });
  }
  return ships;
}
