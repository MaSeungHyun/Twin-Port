import { useOccupancyStore } from "@/stores/occupancy";
import type { Object3D } from "three";

const listeners = new Set<(look: boolean) => void>();

/** 99 = 복원 끝. 0 건물은 나눠 켜는 중, 1 선체, 2 야드, 3 선적, 4 그림자, 5 반사. */
let stage = 99;
const heavyListeners = new Set<() => void>();
let holdFrame = 0;

function emitHeavy() {
  for (const fn of heavyListeners) fn();
}

export function occupancyStage() {
  return stage;
}

/** 그림자까지 복원됐는지. 반사는 그 다음 단계. */
export function occupancyHeavyReady() {
  return stage >= 4;
}

export function subscribeOccupancyHeavy(listener: () => void) {
  heavyListeners.add(listener);
  return () => heavyListeners.delete(listener);
}

/**
 * 한 프레임에 포트 전체를 다시 그리면 WebGPU 파이프라인 바인딩이 수 초 멈춘다.
 * 건물 메시는 따로 나눠 켜고, 선체·야드·선적·그림자·반사는 프레임을 나눠 켠다.
 */
export function holdOccupancyHeavy() {
  cancelAnimationFrame(holdFrame);
  stage = 0;
  emitHeavy();
  const marks = [1, 2, 3, 4, 5, 99];
  let index = 0;
  let wait = 3;
  const step = () => {
    if (useOccupancyStore.getState().occupancyMode) return;
    if (wait > 0) {
      wait -= 1;
      holdFrame = requestAnimationFrame(step);
      return;
    }
    stage = marks[index] ?? 99;
    index += 1;
    emitHeavy();
    if (index < marks.length) holdFrame = requestAnimationFrame(step);
  };
  holdFrame = requestAnimationFrame(step);
}

/** 복구 도중 오큐펀시를 다시 켠 경우. 단계를 99로 올리지 않아 그림자·메시가 한 프레임에 되살아나지 않는다. */
export function cancelOccupancyRestore() {
  cancelAnimationFrame(holdFrame);
}

export function releaseOccupancyHeavy() {
  cancelAnimationFrame(holdFrame);
  if (stage === 99) return;
  stage = 99;
  emitHeavy();
}

/** 지면/선체처럼 React visible 이 아닌 쪽에서 가시성을 맞추는 쪽을 등록한다. */
export function registerOccupancySync(fn: (look: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * userData.occupancyOnly 와 등록된 apply 를 현재 occupancyLook 에 맞춘다.
 * 로딩 예열은 숨긴 메시를 잠깐 켜므로, 끝난 뒤 이 함수로 일반 뷰를 되돌린다.
 */
export function syncOccupancyVisibility(root?: Object3D | null) {
  const look = useOccupancyStore.getState().occupancyLook;
  root?.traverse((o) => {
    if (o.userData.occupancyOnly) o.visible = look;
  });
  for (const fn of listeners) fn(look);
}
