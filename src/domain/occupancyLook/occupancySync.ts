import { useOccupancyStore } from "@/stores/occupancy";
import type { Object3D } from "three";

const listeners = new Set<(look: boolean) => void>();

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
