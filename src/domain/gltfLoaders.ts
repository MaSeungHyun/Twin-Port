import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { LoaderUtils } from "three";
import type { GLTFLoader } from "three-stdlib";
import { fetchGlb } from "@/domain/glbCache";

/**
 * [perf] BUSAN.glb 최적화(KTX2 텍스처 + EXT_meshopt_compression) 로더 설정.
 * - KTX2: basis transcoder 는 public/basis/ 에 복사됨 (three/examples/jsm/libs/basis)
 * - detectSupport 는 renderer.init() 이후 1회 (Scene.tsx createRenderer)
 * - meshopt 은 drei useGLTF 3번째 인자(true)로 MeshoptDecoder 연결
 * 폴백: 문제가 생기면 busan.glb.backup-* (PNG/비압축 원본)로 되돌리고 이 extendLoader 를 빼면 됨.
 */
export const ktx2Loader = new KTX2Loader().setTranscoderPath(
  `${import.meta.env.BASE_URL}basis/`,
);

let ready = false;
const pending: (() => void)[] = [];

export function initKtx2Support(renderer: unknown) {
  if (ready) return;
  try {
    ktx2Loader.detectSupport(renderer as never);
  } catch (error) {
    // [ktx2] 기능 조회 실패해도 큐는 풀어 로딩이 멈추지 않게 (transcoder 가 비압축 RGBA 로 폴백)
    console.warn("[ktx2] detectSupport 실패", error);
  }
  ready = true;
  for (const fn of pending.splice(0)) fn();
}

/** detectSupport 이후에 실행 (모듈 레벨 preload 용) */
export function whenKtx2Ready(fn: () => void) {
  if (ready) fn();
  else pending.push(fn);
}

export const extendKtx2 = (loader: GLTFLoader) => {
  loader.setKTX2Loader(ktx2Loader as never);
  // [perf] 바이트는 glbCache 에서 (prefetch 와 요청 공유 + Cache Storage). 로딩바(useProgress)용 manager item 은 그대로 보고
  loader.load = (url, onLoad, _onProgress, onError) => {
    const manager = loader.manager;
    const resolved = manager.resolveURL(url);
    manager.itemStart(resolved);
    const fail = (error: unknown) => {
      onError?.(error as ErrorEvent);
      manager.itemError(resolved);
      manager.itemEnd(resolved);
    };
    fetchGlb(resolved).then(
      (buffer) =>
        loader.parse(
          buffer,
          loader.path || LoaderUtils.extractUrlBase(resolved),
          (gltf) => {
            onLoad(gltf);
            manager.itemEnd(resolved);
          },
          fail,
        ),
      fail,
    );
  };
};
