import { beginSceneWarmTask } from "../Port/WaterReflection";

/**
 * [loader] 바다 FFT(WebGL 프래그먼트 / WebGPU 컴퓨트)와 수면 재질은 씬 메시가 아니라
 * 첫 useFrame 에서 컴파일된다. 해안 베이크가 끝나는 순간 로더가 닫히지 않게 붙잡고,
 * Ocean 이 한 번 돌려 파이프라인을 만든 뒤 놓는다. 그 다음 SceneWarmup 이 수면 메시를 컴파일.
 */
let release: (() => void) | null = null;
let done = false;

export function holdOceanWarmup() {
  if (done || release) return;
  release = beginSceneWarmTask();
}

export function releaseOceanWarmup() {
  done = true;
  const finish = release;
  release = null;
  finish?.();
}
