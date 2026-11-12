import type { Object3D } from "three";

/**
 * [wire] 와이어(외곽선) 모드 셰이더 예열 연결점.
 * OutlineMode(WebGPU 전용)가 등록하고, 로딩 예열(SceneWarmup)이 객체마다 불러 외곽선 렌더 타깃 문맥 변형도 미리 만든다.
 * WebGL 이거나 OutlineMode 가 아직 없으면 null 이라 예열을 건너뛴다(관제 시작 뒤 백그라운드 예열이 보충).
 */
export type OutlineWarmer = {
  /** 객체 하나를 외곽선 문맥으로 compileAsync. 외곽선에서 숨는 객체는 undefined */
  object: (object: Object3D, camera: unknown, scene: Object3D) => Promise<unknown> | undefined;
  /** 화면 합성 쿼드 */
  composite: () => Promise<unknown>;
};

let current: OutlineWarmer | null = null;

export function setOutlineWarmer(warmer: OutlineWarmer) {
  current = warmer;
  return () => {
    if (current === warmer) current = null;
  };
}

export function getOutlineWarmer() {
  return current;
}
