import { ENVIRONMENT_ROTATION } from "@/constants/environment";
import { create } from "zustand";

function radToDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export type EnvironmentRotationDeg = {
  x: number;
  y: number;
  z: number;
};

const INITIAL_ROTATION_DEG: EnvironmentRotationDeg = {
  x: radToDeg(ENVIRONMENT_ROTATION.x),
  y: radToDeg(ENVIRONMENT_ROTATION.y),
  z: radToDeg(ENVIRONMENT_ROTATION.z),
};

const INITIAL_ROTATION_DEG_LOADED: EnvironmentRotationDeg = { ...INITIAL_ROTATION_DEG };

type EnvironmentDebugState = {
  rotationDeg: EnvironmentRotationDeg;
  setRotationDeg: (axis: keyof EnvironmentRotationDeg, value: number) => void;
  resetRotationDeg: () => void;
};

// [slider] HDR Y 회전 저장 (0~360°)
const ENV_ROT_KEY = "tp.envRotY.v1";
function loadEnvRotY() { try { const v = parseFloat(localStorage.getItem(ENV_ROT_KEY) ?? ""); return Number.isFinite(v) ? v : null; } catch { return null; } }
const _savedY = loadEnvRotY();
if (_savedY != null) INITIAL_ROTATION_DEG_LOADED.y = _savedY;

export const useEnvironmentDebugStore = create<EnvironmentDebugState>((set) => ({
  rotationDeg: INITIAL_ROTATION_DEG_LOADED,
  setRotationDeg: (axis, value) =>
    set((state) => {
      if (axis === "y") { try { localStorage.setItem(ENV_ROT_KEY, String(value)); } catch { /* ignore */ } }
      return {
      rotationDeg: { ...state.rotationDeg, [axis]: value },
      };
    }),
  resetRotationDeg: () => { try { localStorage.removeItem(ENV_ROT_KEY); } catch { /* ignore */ } set({ rotationDeg: INITIAL_ROTATION_DEG }); },
}));

export function environmentRotationRad(rotationDeg: EnvironmentRotationDeg) {
  return [
    degToRad(rotationDeg.x),
    degToRad(rotationDeg.y),
    degToRad(rotationDeg.z),
  ] as [number, number, number];
}

export function formatEnvironmentRotationEuler(rotationDeg: EnvironmentRotationDeg) {
  const [x, y, z] = environmentRotationRad(rotationDeg);
  const fmt = (n: number) => {
    if (Math.abs(n) < 1e-6) return "0";
    if (Math.abs(n - Math.PI / 2) < 1e-6) return "Math.PI / 2";
    if (Math.abs(n + Math.PI / 2) < 1e-6) return "-Math.PI / 2";
    if (Math.abs(Math.abs(n) - Math.PI) < 1e-6) {
      return n < 0 ? "-Math.PI" : "Math.PI";
    }
    return n.toFixed(4);
  };
  return `new Euler(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`;
}
