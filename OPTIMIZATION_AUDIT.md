# Twin-Port 웹 3D 최적화 점검

- 기준: maseunghyun-pc의 `codex/port-call-demo` 작업 트리 (2026-11-12)
- 1차 점검은 코드만 읽고 작성했고, 이후 승현님 요청으로 적용 가능한 기법을 실제로 반영했어요. 반영 결과는 아래 [적용 결과](#적용-결과-2026-11-12) 절에 있어요.
- 기대 효과는 일반적인 경향이고 측정값이 아니에요. 실제 효과는 PerfOverlay의 draws/tris와 프레임 시간으로 전후를 재서 확인해야 해요.

## 목차

1. [결론: GPU 텍스처 기법](#결론-gpu-텍스처-기법)
2. [측정한 에셋](#측정한-에셋)
3. [기법별 적용 현황](#기법별-적용-현황)
4. [우선 추천](#우선-추천)
5. [적용 결과 (2026-11-12)](#적용-결과-2026-11-12)
6. [참고 자료](#참고-자료)

## 결론: GPU 텍스처 기법

> **바다에는 적용돼 있고, 항만 오브젝트에는 아직 적용 안 돼 있어요.** (점검 시점 기준)
>
> 바다 FFT는 TSL compute로 스토리지 버퍼에서 계산하고 결과를 렌더 타깃 텍스처로 바로 씁니다. 해안 필드도 워커에서 한 번 구워서 텍스처로 공유해요. 반면 컨테이너, 크레인, 배는 CPU에서 행렬을 계산해 InstancedMesh에 올리는 방식이라, 인스턴스 상태를 데이터 텍스처나 스토리지 버퍼에 담아 셰이더가 읽는 구조는 아니에요.

텍스처 압축 쪽은 KTX2(GPU 압축 포맷)와 밉맵이 대부분 적용돼 있어요. 남은 PNG는 2장이에요. (→ 적용 후: 2장 모두 KTX2로 변환)

## 측정한 에셋

GLB 헤더와 내장 텍스처 헤더를 직접 읽은 값 (점검 시점)

| 파일 | 크기 | 확장 | 텍스처 |
|---|---|---|---|
| ship.glb | 10.5 MB | meshopt, quantization, basisu | KTX2 15장 (1024² 10장, 512² 4장) |
| BUSAN.glb | 8.0 MB | meshopt, quantization, basisu | KTX2 30장 (4500² 지면 1장, 1024² 5장, 256²급 24장 등) |
| overhead_crane.glb | 1.6 MB | meshopt, basisu | KTX2 2장 + PNG 1024² 1장 (1.1 MB) |
| containers.glb | 0.3 MB | 없음 | PNG 1024² 1장 (326 KB) |
| sky.hdr / port_hdr.hdr | 1.4 MB / 1.1 MB | — | HDR, PMREM 변환해 사용 |

## 기법별 적용 현황

"적용 여부"는 점검 시점 상태, "이번 반영"은 2026-11-12에 실제로 한 작업이에요.

| 기법 | 적용 여부 | 근거 파일 | 기대 효과 | 난이도 | 이번 반영 |
|---|---|---|---|---|---|
| TSL compute + 스토리지 버퍼 → 텍스처 | 적용 | `OceanTsl/webgpu/fftGPU.ts` (instancedArray, .compute, RenderTarget) | 바다 FFT를 GPU에서 계산해 텍스처로 바로 사용 | — | — |
| 데이터 텍스처(베이크 후 재사용) | 적용 | `domain/waterSim.ts`, `OceanTsl/portShore.ts`, `OceanTsl/scene/resources.ts` | 해안 필드를 워커에서 한 번 굽고 Water·Ground가 같은 텍스처 공유 | — | — |
| 인스턴스 상태를 데이터 텍스처/스토리지 버퍼로 | 미적용 | 컨테이너·크레인·배는 CPU `setMatrixAt` + `needsUpdate` | 상태·색·하이라이트를 버퍼 하나로 → 메시·재질 수 감소 | 중 | **적용(컨테이너 색)**: 블록×색마다 따로 있던 InstancedMesh를 블록당 1개로 합치고, 색은 인스턴스 attribute(`containerColor`)로 셰이더에서 선택. 하이라이트·상태 표시는 기존 경로 유지 |
| KTX2(Basis) GPU 압축 텍스처 | 부분 | `domain/gltfLoaders.ts`, `ktx2MainThread.ts` / BUSAN·ship은 전부 KTX2, overhead_crane PNG 1장·containers PNG 1장 | VRAM·업로드 시간 감소 | 하 | **적용**: overhead_crane 노멀맵 → UASTC KTX2, containers 아틀라스 → UASTC KTX2 (밉맵 포함) |
| 밉맵 | 적용 | KTX2 텍스처마다 밉 9~13단계 내장 | 먼 거리 깜빡임·대역폭 감소 | — | 새 KTX2 2장도 밉맵 내장 |
| 메시 압축(meshopt) + 양자화 | 적용 | BUSAN·ship·overhead_crane: `EXT_meshopt_compression`, `KHR_mesh_quantization` | 다운로드·파싱 감소 | — | — (지오메트리 바이트는 건드리지 않음) |
| GLB 바이트 캐시 | 적용 | `domain/glbCache.ts` (Cache Storage) | 새로고침 시 재다운로드 없음 | — | — |
| InstancedMesh | 적용 | `containerInstancePool.ts`, `quayCraneInstance.ts`, `ContainerYard.tsx`, `ShipCargo.tsx`, `BlockMarks.tsx` 등 | 드로우콜 감소 | — | **추가**: 인스턴스 행렬을 실제 개수만큼만 업로드(`updateRanges`), 개수 0이면 업로드 생략 |
| 반복 구간 인스턴싱 + 청크 컬링 | 적용 | `domain/repeatMesh.ts` (Fence/Road/LimitLine, 약 240m 칸) | 화면 밖 구간 제외 | — | — |
| 정적 지오메트리 병합 | 적용 | `domain/mergeStaticGeometry.ts` | 드로우콜 감소 | — | — |
| BatchedMesh | 미적용 | — | 모양이 다른 정적 부품을 한 드로우로 + 개별 컬링 | 중 | **보류**: three r185 WebGPU 백엔드는 BatchedMesh를 인스턴스마다 drawIndexed로 그려 드로우콜이 줄지 않고, 정적 메시는 이미 병합돼 있음 |
| LOD / 메시 단순화 | 적용 | `craneLod.ts`, `shipLod.ts`, `constants/*Lod.ts`, `ContainerYard.tsx`, 워커 `meshopt.worker.ts` | 먼 거리 삼각형 감소 | — | — |
| 임포스터 / HLOD | 미적용 | — | 아주 먼 배·크레인을 카드 1장으로 | 중상 | **보류**: 컨테이너 열 LOD·배 LOD3가 이미 있고, 카드 전환 시 조명·그림자·콜아웃 정합 위험이 큼 |
| 버텍스 애니메이션 텍스처 | 미적용(불필요) | 애니메이션은 행렬 이동뿐 (GLB 애니메이션 0개) | 해당 없음 | — | 해당 없음 |
| 텍스처 아틀라스 / 배열 텍스처 | 미적용 | BUSAN.glb에 256px 텍스처 24장 | 재질·바인딩 수 감소 | 중 | **보류**: BUSAN 모델의 UV·재질 재작업(원본 DCC 작업)이 필요 |
| 셰이더 예열(compileAsync) | 적용 | `compileObject.ts`, `renderGate.ts`, `warmupOccupancyPrograms.ts`, `craneDepthFade.ts` | 런타임 재컴파일·끊김 제거 | — | 새 통합 컨테이너 재질도 기존 예열 경로(`warmMaterials`)에 등록 |
| 인스턴스 셰이더 공유 | 적용 | `domain/shareInstanceShaders.ts` | 파이프라인 수 감소 | — | — |
| 렌더 게이트(로딩 중 화면 렌더 생략) | 적용 | `domain/renderGate.ts` | 초기 long task 제거 | — | — |
| Render on demand | 부분 | `Scene.tsx` frameloop always, `MonitorFrameLoopGate.tsx`에서 모니터 모드만 never | 정지 화면 GPU 사용 감소 | 하 | **보류**: 바다·시뮬레이션·크레인이 계속 움직여 매 프레임 렌더가 필요하고, `Scene.tsx`에서 MonitorFrameLoopGate가 의도적으로 주석 처리돼 있음. 숨긴 탭은 rAF가 이미 멈춤 |
| 해상도 스케일(DPR) | 부분 | `Scene.tsx` dpr = min(devicePixelRatio, renderScale) 프리셋 | 고정 프리셋만 | 하 | **제거(사용자 요청, 2026-11-12)**: 카메라 조작 중 DPR 0.75배 하향(`AdaptiveDprOnMove`)은 움직일 때 화면이 흐려져서 뺐음. 지금은 고정 프리셋(renderScale)만 사용 |
| 그림자 최적화 | 부분 | `SunLight.tsx`: 2048 맵, 카메라 추종·텍셀 스냅, off/low/high, 점유 모드에서 정지. 그 외엔 매 프레임 갱신 | 정적·동적 분리나 주기 갱신으로 비용 감소 | 중 | **적용(주기 갱신)**: 그림자 맵을 2프레임에 1번 갱신 (`SUN_SHADOW_UPDATE_EVERY = 2`). 카메라 이동·프러스텀 변경·일시정지 해제 시에는 즉시 갱신. 정적·동적 분리는 three WebGPU 구조상 보류 |
| CSM(계단식 그림자) | 미적용 | — | 넓은 항만에서 가까운 곳 해상도 확보 | 중 | **보류**: 캐스케이드마다 그림자 패스가 늘고 재질 재컴파일이 생김. 카메라 추종 그림자가 이미 근거리 해상도를 확보 |
| 물 반사 | 부분 | `WaterReflection.tsx`: 반사 카메라 없이 Y 반전 복제본 + 단순화 | RT 비용은 없지만 반사 대상 드로우콜이 늘어남 | — | — (Ocean-TSL·반사는 수정 안 함) |
| 간접 드로우 / GPU 컬링 | 미적용 | — | 수만 인스턴스에서 CPU 부담 제거 (WebGPU 전용) | 상 | **보류**: WebGPU 전용이라 WebGL2 폴백에서 동작 안 하고, 현재 인스턴스 수로는 효과가 작음 |
| 오클루전 컬링 | 미적용 | — | 가려진 블록·컨테이너 제외 | 상 | **보류**: three/R3F에 내장 기능이 없어 직접 구현 필요, 위험 대비 효과 불확실 |
| 워커 활용 | 적용 | `meshoptPool.ts`·`meshopt.worker.ts`(단순화), `shoreBake.worker.ts`. KTX2 트랜스코드는 메인 스레드 | 메인 스레드 부하 분산 | — | **적용**: KTX2 트랜스코드를 워커 2개로 복구 (`public/basis/ktx2_worker.js`). 워커가 5초 안에 준비되지 않거나 오류가 나면 기존 메인 스레드 방식으로 자동 전환 |
| OffscreenCanvas | 미적용 | — | 렌더를 워커로 (R3F와 궁합이 까다로움) | 상 | **보류**: drei Html 3D 콜아웃이 DOM을 필요로 함 |
| 리소스 해제(dispose) | 적용 | `containerInstancePool.ts`, `Scene.tsx`, `OutlineMode.tsx` 등 18개 파일 | 메모리 누수 방지 | — | 통합 컨테이너 지오메트리·재질도 언마운트 시 해제 |
| React: useFrame 안에서 직접 변경 | 적용 | `OverHeadCrane.tsx` writeMatrices, `ContainerYard.tsx` LOD 주기 검사 | 리렌더 없이 갱신 | — | — |
| (추가) 크레인·배 행렬 GPU compute | — | — | — | — | **보류**: 인스턴스 수가 적어 효과가 작고 WebGL2 폴백에서 지원 안 됨 |

## 우선 추천

(점검 시점에 작성한 추천. 각 항목 끝에 반영 결과를 붙였어요.)

1. 남은 PNG 2장을 KTX2로 변환: overhead_crane.glb의 1024² PNG(1.1 MB)와 containers.glb의 PNG(326 KB). 이미 쓰는 gltf-transform으로 바로 할 수 있고 로더도 준비돼 있어요. 난이도 하. → **적용**
2. 컨테이너 상태를 인스턴스 버퍼로 합치기: 지금은 블록×색마다 InstancedMesh를 따로 두고 하이라이트도 별도 재질이에요. 색·상태·하이라이트를 인스턴스 attribute나 데이터 텍스처에 넣어 셰이더에서 읽으면 메시와 재질 수가 줄고 예열할 조합도 줄어요. 질문하신 'GPU 텍스처를 만들고 갖다쓰는' 방식이 가장 효과를 볼 곳이에요. 난이도 중. → **색상만 적용** (하이라이트는 기존 유지)
3. 그림자 갱신 줄이기: 2048 맵을 매 프레임 다시 그려요. 지면·블록 같은 정적 그림자와 움직이는 크레인·배를 나누거나, 카메라가 멈췄을 때는 몇 프레임에 한 번만 갱신하는 방식이 있어요. 난이도 중. → **2프레임마다 갱신으로 적용**
4. 카메라 이동 중 해상도 낮추기: R3F performance.regress로 회전·이동 중에만 DPR을 낮추고 멈추면 되돌리기. → 적용했다가 **제거** (사용자 요청: 움직일 때 해상도를 낮추지 않기)
5. KTX2 트랜스코드 워커 복구: 브라우저 문제로 메인 스레드에서 돌리고 있어서(`ktx2MainThread.ts`) 로딩 중 메인 스레드가 막힐 수 있어요. 원인이 풀리면 워커로 되돌리는 게 좋아요. 난이도 중. → **적용** (실패 시 메인 스레드로 자동 전환)
6. 나중에 검토: BUSAN의 작은 텍스처 24장을 배열 텍스처나 아틀라스로 묶기, 먼 배에 임포스터, 컨테이너가 훨씬 많아지면 compute 컬링 + 간접 드로우. 지금 규모에서는 효과 대비 작업량이 커요. → **보류**

## 적용 결과 (2026-11-12)

### 적용한 기법과 변경 파일

| # | 기법 | 변경 파일 |
|---|---|---|
| 1 | KTX2 변환 (overhead_crane 노멀맵) | `src/assets/model/overhead_crane.glb` (이미지 바이트만 교체, meshopt 지오메트리 그대로) |
| 2 | KTX2 변환 (containers 아틀라스) | `src/assets/model/containers.glb`, `ContainerYard.tsx`·`ShipCargo.tsx` (`useGLTF.preload`를 `whenKtx2Ready(...)` 뒤로) |
| 3 | KTX2 트랜스코드 워커 복구 | `public/basis/ktx2_worker.js` (신규), `src/domain/ktx2MainThread.ts` (`createWorkerFirst`, 워커 2개, 5초 타임아웃 후 메인 스레드 폴백) |
| 4 | 그림자 맵 주기 갱신 | `src/constants/sunLight.ts` (`SUN_SHADOW_UPDATE_EVERY = 2`), `src/views/viewport/_components/SunLight.tsx` |
| 5 | ~~사용자 조작 중 DPR 하향~~ **제거** (사용자 요청) | `AdaptiveDprOnMove.tsx` 삭제, `Scene.tsx` 의 `performance` 설정·`<AdaptiveDprOnMove />` 제거 |
| 6 | 인스턴스 행렬 부분 업로드 | `src/domain/instanceUpload.ts` (신규, `commitInstanceMatrices`), `Ship.tsx`, `OverHeadCrane.tsx` |
| 7 | 컨테이너 색 인스턴스 attribute 통합 | `src/domain/containerPrototype.ts` (`buildUnifiedContainerGeometry`, `applyUnifiedContainerColor`), `src/domain/containerInstancePool.ts` (`ensureUnifiedContainerBlockMesh`), `ContainerYard.tsx` (통합 경로 + 해제). 통합 준비에 실패하면 콘솔 경고 후 기존 색별 경로로 동작 |

### 에셋 크기 (전 → 후)

| 파일 | 전 | 후 | 텍스처 VRAM 추정 |
|---|---|---|---|
| overhead_crane.glb | 1,729,460 B | 1,465,320 B (−15%) | 노멀맵 5.59 MB → 1.40 MB |
| containers.glb | 341,316 B | 805,632 B (+136%) | 아틀라스 5.59 MB → 1.40 MB |

- containers.glb는 처음에 ETC1S(230,800 B)로 변환했지만, 색 아틀라스라 먼 거리 밉맵에서 색이 섞여 컨테이너 색이 탁해졌어요(채도 약 45% 감소 측정). 그래서 UASTC로 다시 변환했고, 먼 거리 채도가 원본 PNG와 거의 같아요(원본 32.5 / UASTC 31.2). 다운로드는 약 464 KB 늘지만 GPU 메모리는 약 75% 줄고 GPU에서 밉맵을 만들 필요가 없어요. 다운로드 크기가 더 중요하면 원본 PNG로 되돌리는 선택지도 있어요.
- overhead_crane 노멀맵은 UASTC(노멀맵 권장 포맷)로 변환했어요.

### 보류한 기법

Render on demand, BatchedMesh, 임포스터/HLOD, 오클루전 컬링, OffscreenCanvas, CSM, 텍스처 아틀라스/배열 텍스처(BUSAN), 크레인·배 행렬 GPU compute, 간접 드로우/GPU 컬링, 그림자 정적·동적 분리. 이유는 위 표의 "이번 반영" 열에 있어요.

### 빌드 결과

- `npx tsc -b`: 오류 0
- `npm run build`: 성공
- 기존부터 있던 콘솔 오류(mergeGeometries uv 오류, TSL vec3 length 오류, `uv not found`)는 변경 전과 동일해요.

### 브라우저에서 확인할 것

1. 콘솔에 `[ktx2] 워커 트랜스코더 … → 메인 스레드` 경고가 없는지, DevTools Network에 `ktx2_worker.js`가 로드되는지
2. 컨테이너 색이 변경 전과 같은지(가까이·멀리 모두), 블록 하이라이트·선택·콜아웃이 그대로 동작하는지
3. 콘솔에 `[ContainerYard] 통합 컨테이너 geometry 생성 실패` 경고가 없는지 (있으면 기존 색별 경로로 동작 중)
4. 마우스로 카메라를 돌려도 해상도가 그대로인지 (이동 중 DPR 하향 제거됨)
5. 크레인·배가 움직일 때 그림자가 끊기거나 늦게 따라오지 않는지
6. 오버헤드 크레인 표면 디테일(노멀맵)이 변경 전과 같은지
7. 처음 모드 전환·하이라이트 시 셰이더 컴파일 끊김이 새로 생기지 않는지
8. PerfOverlay의 draws/프레임 시간을 변경 전후로 비교

### 끊김 추가 수정 (2026-11-12, 관제 시작 비행·초반 끊김)

| 원인 | 수정 | 파일 |
|---|---|---|
| `Node.captureStackTrace = true` 가 배포 빌드에서도 켜져, TSL 노드마다 `Error().stack` 생성·파싱. 프로파일에서 노드 빌드 시간의 약 79% | 주소에 `?tsltrace` 를 붙였을 때만 켜도록 변경 | `src/debug/tslTrace.ts` |
| 예열 중복 제거 키가 three 의 실제 노드 캐시 키와 달라, InstancedMesh(three 는 객체 uuid 를 키에 넣음)·재질 값이 다른 메시는 첫 객체만 예열되고 나머지는 처음 화면에 들어올 때 빌드됨 (관제 시작 직후 첫 프레임에 야드 블록 30개·크레인 인스턴스 4개 등 44개 빌드 측정) | 예열 키를 three `RenderObject.getCacheKey` 규칙(인스턴스 uuid, 재질 값, 정점 속성 세부, receiveShadow)에 맞춤 | `src/views/viewport/_components/Port/WaterReflection.tsx` (`shaderVariantKey`) |
| 이동 중 DPR 하향이 스크립트 트윈에도 걸려 비행 시작/끝에 캔버스·렌더 타깃 크기 변경 | 사용자 조작 중에만 동작 → 이후 사용자 요청으로 기능 제거 | `AdaptiveDprOnMove.tsx` (삭제) |

- 예열 대상이 늘어 로딩(‘준비 중…’)이 조금 길어질 수 있어요. 대신 그 작업이 화면 표시 뒤로 밀리지 않아요.
## 참고 자료

- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips) — utsubo.com
- [Performance, measured: instancing, batching, LOD](https://spareilleux.github.io/learn/threejs/08-performance-instancing-batching-lod/) — spareilleux.github.io
- [BatchedMesh 문서](https://threejs.org/docs/pages/BatchedMesh.html) — threejs.org
- [WebGPU 간접 드로우 예제](https://threejs.org/examples/webgpu_struct_drawindirect.html) — threejs.org
- [IndirectStorageBufferAttribute PR](https://github.com/mrdoob/three.js/pull/29594) — github.com/mrdoob/three.js
- [BatchedMesh via drawIndexedIndirect PR](https://github.com/mrdoob/three.js/pull/30645) — github.com/mrdoob/three.js
- [WebGPU 스토리지 버퍼 예제](https://threejs.org/examples/webgpu_storage_buffer.html) — threejs.org
- [WebGPU compute 파티클 예제](https://threejs.org/examples/webgpu_compute_particles.html) — threejs.org
- [WebGPU CSM 그림자 예제](https://threejs.org/examples/webgpu_shadowmap_csm.html) — threejs.org
- [배열 텍스처 예제](https://threejs.org/examples/webgl_texture2darray.html) — threejs.org
- [Choosing texture formats for WebGL and WebGPU](https://www.donmccurdy.com/2024/02/11/web-texture-formats/) — donmccurdy.com
- [glTF Transform CLI (KTX2, meshopt)](https://gltf-transform.dev/cli) — gltf-transform.dev
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/) — toji.dev
- [R3F Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) — r3f.docs.pmnd.rs
- [R3F Performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls) — r3f.docs.pmnd.rs
- [Discover three.js Tips and Tricks](https://discoverthreejs.com/tips-and-tricks/) — discoverthreejs.com

## 사용자 요청 변경 (2026-11-12 오전)

| 항목 | 원인 | 조치 | 파일 |
| --- | --- | --- | --- |
| 와이어 첫 전환이 느림 | 와이어(외곽선) 모드는 씬을 MRT 렌더 타깃에 다시 그려 재질마다 셰이더 변형이 따로 필요한데, 그 예열이 관제 시작 2.5초 뒤부터 조금씩 돌아 첫 전환 때 남은 변형을 한 프레임에 빌드 | 로딩 예열(SceneWarmup)이 객체·LOD·페이드 변형마다 외곽선 문맥으로도 compileAsync, 합성 쿼드도 로더 뒤에서 컴파일. 기존 관제 시작 뒤 예열은 늦게 생긴 객체 보충용으로 유지 | `OutlineMode.tsx`, `Port/WaterReflection.tsx`, `domain/outlineWarm.ts`(신규) |
| 상세 패널 '위치추적'이 패널을 닫음 | 버튼이 목록 클릭용 토글(같은 대상 재선택 = 닫기)을 호출 | 목록 클릭과 같은 Tracking(selectCrane / selectOverheadCrane / selectShip)만 호출 | `crane/CraneHud.tsx`, `ship/ShipHud.tsx` |
| 카메라 이동 중 해상도 하향 | 사용자 요청 | 제거 | `Scene.tsx`, `AdaptiveDprOnMove.tsx` 삭제 |
