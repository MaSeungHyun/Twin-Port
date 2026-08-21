import {
  OCCUPANCY_TRANSITION as T,
  occupancyDimRef,
} from "@/constants/occupancyTransition";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import {
  AmbientLight,
  DirectionalLight,
  FogExp2,
  type Object3D,
  type Scene,
} from "three";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** 가운데가 가장 어두운 포물선 오버레이 (진입/이탈 공통) */
function overlayOpacity(t: number) {
  return 4 * t * (1 - t) * T.overlayPeak;
}

type AtmosphereTargets = {
  sun: DirectionalLight | null;
  ambient: AmbientLight | null;
  water: Object3D | null;
};

function cacheTargets(scene: Scene, cache: AtmosphereTargets) {
  if (cache.sun && cache.ambient && cache.water) return;
  scene.traverse((obj) => {
    if (!cache.sun && obj instanceof DirectionalLight) cache.sun = obj;
    if (!cache.ambient && obj instanceof AmbientLight) cache.ambient = obj;
    if (!cache.water && obj.userData?.sim) cache.water = obj;
  });
}

function applyAtmosphere(
  scene: Scene,
  cache: AtmosphereTargets,
  t: number,
) {
  scene.backgroundIntensity = lerp(T.backgroundFrom, T.backgroundTo, t);
  scene.environmentIntensity = lerp(T.environmentFrom, T.environmentTo, t);

  if (scene.fog instanceof FogExp2) {
    scene.fog.density = lerp(T.fogFrom, T.fogTo, t);
  }

  const overlay = occupancyDimRef.current;
  if (overlay) overlay.style.opacity = String(overlayOpacity(t));

  if (cache.sun) cache.sun.intensity = lerp(T.sunFrom, T.sunTo, t);
  if (cache.ambient) cache.ambient.intensity = lerp(T.ambientFrom, T.ambientTo, t);
  if (cache.water) cache.water.visible = t < T.waterHideAt;
}

/** occupancy 전환 — HDRI/조명 페이드 + 중간 딤 오버레이 */
export default function OccupancyTransition() {
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const scene = useThree((state) => state.scene);
  const progress = useRef({ t: occupancyMode ? 1 : 0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const cache = useRef<AtmosphereTargets>({
    sun: null,
    ambient: null,
    water: null,
  });

  useFrame(() => {
    cacheTargets(scene, cache.current);
    const t = progress.current.t;
    applyAtmosphere(scene, cache.current, t);

    const { occupancyLook, occupancyMode: mode } = useOccupancyStore.getState();
    const monitorMode = useViewportStore.getState().monitorMode;
    const nextLook = !monitorMode && (mode ? t >= T.lookAt : t > T.lookAt);
    if (nextLook !== occupancyLook) {
      queueMicrotask(() => {
        const occupancy = useOccupancyStore.getState();
        const look =
          !useViewportStore.getState().monitorMode &&
          (occupancy.occupancyMode
            ? progress.current.t >= T.lookAt
            : progress.current.t > T.lookAt);
        if (look !== occupancy.occupancyLook) {
          occupancy.setOccupancyLook(look);
        }
      });
    }
  });

  useEffect(() => {
    const target = occupancyMode ? 1 : 0;
    const from = progress.current.t;
    tweenRef.current?.kill();

    if (Math.abs(from - target) < 1e-4) {
      progress.current.t = target;
      return;
    }

    tweenRef.current = gsap.to(progress.current, {
      t: target,
      duration: T.duration * Math.abs(target - from),
      ease: "power2.inOut",
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [occupancyMode]);

  return null;
}
