import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { skyState } from "../spectrum";
import { useSettingsEffect } from "../state/useSettingsEffect";
import { useSettings } from "../state/settingsStore";
import { countRender } from "../dev/renderCount";
import { PRI, useScene } from "./context";
import { probeRT } from "./resources";
import { Bubbles } from "./Bubbles";
import { oceanClock, oceanState, sampleOceanY } from "../oceanApi";
import * as THREE_U from "three";
import { airFogU, oceanEdgeU } from "../webgpu/oceanTSL";
import { cameraPosition, exp, fog, length, mix, normalize, positionView, positionWorld, renderGroup, smoothstep, uniform } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

// [twin-port] 수중 판정 + ocean-tsl main(r3f) FloatingCubes 방식 수중 시야
//   main: col = mix(col, uUWCol*0.6, uUnderG * (1 - exp(-uUWDens * 시야거리)))  (지수 감쇠, /m)
//   → 일반 씬 오브젝트(선박·Ground·크레인 등)에 scene.fogNode 로 동일 식 적용. 유니폼만 바꾸므로 전환 시 재컴파일 없음.
//   바다/하늘/섬 재질은 자체 underFog/uwMedium 을 쓰므로 fog=false (main 과 동일, 이중 적용 방지)
const uw = { under: false, blend: 0, active: false, hOk: false, f: 0, hF: 0, last: 0, wasUnder: false };
// [stale-fix] TSL uniform 기본 그룹은 objectGroup(렌더 오브젝트별 바인딩) → 화면 밖에 있던/캐시된 오브젝트가 이전 값(수중색)을 유지할 수 있음
//   renderGroup 으로 지정해 렌더당 1회 갱신되는 전역 공유 유니폼으로 만듦
const uwFogU = { under: uniform(0).setGroup(renderGroup), col: uniform(new THREE_U.Color(0x0f7f86)).setGroup(renderGroup), dens: uniform(0.09).setGroup(renderGroup) };
// [fog] 수면 위 대기 안개(렌더 패널)와 결합: under=1 → 수중 식(main), under=0 → 대기 안개(on 일 때만). 유니폼만 바꾸므로 재컴파일 없음
const _uwF = uwFogU.under.mul(exp(uwFogU.dens.mul(length(positionView)).negate()).oneMinus());
const _airF = airFogU.on.mul(uwFogU.under.oneMinus()).mul(smoothstep(airFogU.near, airFogU.far, length(positionView)));
const uwFogNode = fog(mix(airFogU.col, uwFogU.col.mul(0.6), uwFogU.under), _uwF.add(_airF));
// [twin-port] 수중 배경: 오브젝트가 없는 픽셀도 물색(main 의 하늘돔 uwMedium 대응). 카메라 중심 뒷면 구, 수중이 아니면 scale≈0
//   (항상 렌더 → 파이프라인 미리 컴파일, 전환 시 재컴파일 없음). WebGL/WebGPU 공통 노드만 사용
const uwBgU = { bright: uniform(1).setGroup(renderGroup) };
const uwBgMat = new MeshBasicNodeMaterial({ side: THREE_U.BackSide, depthWrite: false, depthTest: false, fog: false });
{
  const dir = normalize(positionWorld.sub(cameraPosition));
  uwBgMat.colorNode = uwFogU.col.mul(0.6).mul(mix(0.35, 1.25, smoothstep(-0.9, 0.8, dir.y))).mul(uwBgU.bright);
}
const uwBgGeo = new THREE_U.SphereGeometry(1, 32, 16);
// 깊이 어두워짐: 셰이더 uwMedium 은 exp(-uwExt*d*0.6) → darkRange 에서 ≈5% 가 되도록 깊이를 환산
const DARK_REF = 3 / 0.6; // exp(-3) ≈ 0.05
const UWDBG = typeof location !== "undefined" && /[?&]debug(?:[&=]|$)/.test(location.search);
// [perf] 프레임 단위 [uw] 로그/행 객체는 ?debuglog 일 때만 (DevTools 열린 상태에서 매 프레임 console.log 가 끊김 유발)
const UWLOG = typeof location !== "undefined" && /[?&]debuglog/.test(location.search);

// [twin-port] 셰이더는 수면 로컬(y=0) 좌표 → 카메라를 level 만큼 내려서 전달, 메시는 level 만큼 올림
const camL = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _v2 = new THREE.Vector2();

export function Ocean({ geo }: { geo: THREE.BufferGeometry }) {
  countRender("scene.ocean");
  const { sim, ocean, sky, island, probe } = useScene();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const bgRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const scene = useThree((s) => s.scene);
  // 스펙트럼 재계산은 슬라이더 조작 중 끊김을 줄이려고 짧게 디바운스
  useSettingsEffect(
    (s) => [s.params.wind, s.params.peak, s.params.choppy, s.params.windDir],
    () => {
      const id = setTimeout(() => {
        sim.setParams(useSettings.getState().params);
        ocean.uniforms.uHs.value = sim.hs;
        oceanState.hs = sim.hs;
      }, 60);
      return () => clearTimeout(id);
    },
    [sim, ocean],
  );
  // FFT 해상도 변경 시 sim(타깃)이 재생성되므로 셰이더의 텍셀 수도 갱신
  useSettingsEffect(
    (s) => s.perf.detail,
    (detail) => {
      ocean.uniforms.uTexN.value.set(...sim.N);
      ocean.uniforms.uDetail.value = detail;
    },
    [ocean, sim],
  );
  useSettingsEffect(
    (s) => [s.params.hour, s.params.clouds],
    ([hour, clouds]) => {
      const s = skyState(hour, clouds),
        u = ocean.uniforms;
      u.uSun.value.set(...s.sun);
      u.uSunColor.value.setRGB(...s.sunColor);
      u.uSunI.value = s.sunI;
      u.uZenith.value.setRGB(...s.zenith);
      u.uHorizon.value.setRGB(...s.horizon);
      u.uClouds.value = clouds;
    },
    [ocean],
  );
  useSettingsEffect(
    (s) => s.look,
    (look) => {
      const u = ocean.uniforms;
      u.uDeep.value.set(look.deep);
      u.uShallow.value.set(look.shallow); // sRGB hex → 선형 (ColorManagement)
      u.uTurb.value = look.turbidity;
      u.uClarity.value = look.clarity;
      u.uDepth.value = look.depth;
    },
    [ocean],
  );
  useSettingsEffect(
    (s) => s.under,
    (under) => {
      ocean.uniforms.uUWCol.value.set(under.color);
      ocean.uniforms.uUWDens.value = under.density;
    },
    [ocean],
  );
  useSettingsEffect(
    (s) => s.shore,
    (shore) => {
      const u = ocean.uniforms;
      u.uShoreA.value = shore.shoreWave;
      u.uShoreLen.value = shore.shoreLen;
      u.uShoreFoam.value = shore.shoreFoam;
      u.uWallFoamW.value = shore.wallFoamW ?? 4;
      u.uSharp.value = shore.sharp;
      u.uCollFoam.value = shore.collFoam;
      sim.setFoam(shore.collFoam, shore.persist);
      u.uFoamCol.value.set(shore.foamColor).multiplyScalar(shore.foamBright);
    },
    [ocean, sim],
  );
  useSettingsEffect(
    (s) => s.cube.caustics,
    (on) => {
      ocean.uniforms.uCaust.value = on ? 1 : 0;
    },
    [ocean],
  );
  // FFT 갱신 + 시간/카메라 유니폼
  useFrame((_, rdt) => {
    { // [twin-port] 선체 거품 uniform 매 프레임 갱신 (이전엔 look 설정 effect 안에 있어 갱신되지 않음 → 선체 거품 꺼짐)
      const u = ocean.uniforms, sh = oceanState.ship;
      u.uShip.value.set(sh.x, sh.z, Math.cos(sh.yaw), Math.sin(sh.yaw));
      u.uShipHalf.value.set(sh.hx, sh.hz, sh.on ? 1 : 0);
      const pf = oceanState.shipProfile;
      if (!pf) u.uShipProf.value.w = 0; // 윤곽 없으면 컷아웃/선체거품 없음
      else if (pf.ver !== 0 || u.uShipProf.value.w < 0.5) {
        u.uShipProf.value.set(pf.axis, pf.a0, pf.a1, 1);
        const arr = (u.uShipBins as unknown as { array: THREE.Vector2[] }).array;
        for (let i = 0; i < 64; i++) arr[i]!.set(pf.lo[i]!, pf.hi[i]!);
        pf.ver = 0; // 1회 업로드 표시
      }
    }
    const dt = Math.min(rdt, 0.1),
      { perf } = useSettings.getState();
    time.current += dt;
    const t = time.current;
    oceanClock.t = t;
    const u = ocean.uniforms;
    const cur = sim.update(gl, t, dt, perf.mode, perf.nth);
    for (let c = 0; c < 3; c++) {
      u[`uDisp${c}`].value = sim.disp[c][cur[c]].texture;
      u[`uDer${c}`].value = sim.deriv[c].texture;
    }
    u.uTime.value = u.uTimeV.value = t;
    sky.uniforms.uTime.value = island.uniforms.uTime.value = t;
  }, PRI.ocean);
  // [twin-port] 카메라 의존 부분은 OrbitControls(우선순위 -1) 갱신 *뒤* 같은 프레임에 실행 (이전: 1프레임 늦은 카메라)
  useFrame((_, rdt) => {
    const u = ocean.uniforms;
    const pc = camera as THREE.PerspectiveCamera;
    pc.updateMatrixWorld();
    camL.copy(camera.position);
    camL.y -= oceanState.level;
    island.uniforms.uCam.value.copy(camL);
    u.uCam.value.copy(camL);
    u.uCamV.value.copy(camL);
    sky.uniforms.uCam.value.copy(camL);
    u.uOffset.value.set(camera.position.x, camera.position.z);
    // 근평면 가로 스트립의 실제 FFT 파고를 이번 프레임에 GPU 로 계산 (probeRT) → 셰이더가 픽셀 단위로 수면 위/아래 분할
    pc.getWorldDirection(_fw);
    _rt.setFromMatrixColumn(pc.matrixWorld, 0).normalize();
    const half = Math.tan((pc.fov * Math.PI) / 360) * pc.aspect * pc.near * 1.02;
    const pu = probe.m.uniforms;
    pu.uNearL.value.copy(_fw).multiplyScalar(pc.near).addScaledVector(_rt, -half);
    pu.uNearR.value.copy(_fw).multiplyScalar(pc.near).addScaledVector(_rt, half);
    { const prev = gl.getRenderTarget(); gl.setRenderTarget(probeRT as never); gl.render(probe.scene, probe.cam); gl.setRenderTarget(prev); }
    gl.getDrawingBufferSize(_v2);
    for (const m of [ocean, sky, island]) {
      const q = m.uniforms;
      if (q.uWL) q.uWL.value = probeRT.texture;
      q.uRes?.value.copy(_v2);
      q.uCamF?.value.copy(_fw);
      if (q.uNear) q.uNear.value = pc.near;
    }
    // 카메라 지점 실제 파고: 비동기 리드백(1~2프레임 지연) — 전역 판정용. 수면 근처(±1.2m)는 위 스트립으로 같은 프레임 픽셀 분할
    // [perf] WebGL 의 readRenderTargetPixelsAsync 는 fence 대기로 프레임당 50~80ms 스톨 → 수면 근처(±3m)에서만 리드백, 그 외엔 CPU 근사로 충분
    const gapCpu = sampleOceanY(camera.position.x, camera.position.z, oceanClock.t) - camera.position.y; // [fix] sampleOceanY 는 이미 절대 높이(level 포함) → 이전엔 level 이중 가산으로 리드백 구간이 수면 +15m 에 있었음
    const wantRead = oceanState.visible && Math.abs(gapCpu) < 3; // [perf] WebGPU 도 수면 ±3m 에서만 리드백 (멀면 CPU 근사로 수면 위 판정) // [occ] 숨김 중 리드백 생략
    if (!wantRead) uw.hOk = false;
    if (!probe.busy && wantRead) {
      probe.busy = true;
      const issued = uw.f;
      (gl as unknown as { readRenderTargetPixelsAsync(rt: THREE.RenderTarget, x: number, y: number, w: number, h: number): Promise<ArrayLike<number>> })
        .readRenderTargetPixelsAsync(probeRT, 0, 1, 1, 1)
        .then((r) => { if (r && Number.isFinite(r[0])) { probe.h = r[0]!; uw.hOk = true; uw.hF = issued; } })
        .catch((e) => { if (UWDBG) console.warn("[uw] readback 실패", e); })
        .finally(() => { probe.busy = false; });
    }
    // 수중 판정: 리드백 파고(없으면 CPU 근사), 히스테리시스 1cm, 블렌드 없이 즉시 전환
    const hNow = uw.hOk ? oceanState.level + probe.h : sampleOceanY(camera.position.x, camera.position.z, oceanClock.t);
    const depth = oceanState.visible ? hNow - camera.position.y : -10;
    if (!uw.under && depth > 0.01) uw.under = true;
    else if (uw.under && depth < -0.01) uw.under = false;
    uw.blend = uw.under ? 1 : 0;
    const uset = useSettings.getState().under;
    const ext = Math.max(uset.density * 1.3, 1e-4); // ≈ uwExt
    const camDepthEff = (Math.max(depth, 0) * (DARK_REF / ext)) / Math.max(uset.darkRange, 1);
    uwBgU.bright.value = Math.max(Math.exp(-ext * camDepthEff * 0.6), uset.minBright);
    const bg = bgRef.current;
    if (bg) { bg.position.copy(camera.position); bg.scale.setScalar(uw.under ? (camera as THREE.PerspectiveCamera).far * 0.9 : 1e-6); }
    const split = oceanState.visible ? 1 - THREE.MathUtils.smoothstep(Math.abs(depth), 0.8, 1.6) : 0;
    for (const m of [ocean, sky, island]) {
      m.uniforms.uUnderG.value = uw.blend;
      if (m.uniforms.uSplit) m.uniforms.uSplit.value = split;
      if (m.uniforms.uCamDepth) m.uniforms.uCamDepth.value = camDepthEff;
      if (m.uniforms.uUWFloor) m.uniforms.uUWFloor.value = uset.minBright;
    }
    // [twin-port] ocean-tsl 방식: 전환 시 scene.fog/background 객체를 바꾸지 않음
    // (WebGPU 는 fog 객체 교체 시 모든 재질 파이프라인을 재컴파일 → 첫 전환에 수백 ms 정지가 원인이었음)
    // 안개 객체는 항상 붙여두고 밀도(유니폼)만 0 ↔ 값으로 바꿈
    if (!uw.active) {
      uw.active = true;
      for (const m of [ocean, sky, island]) (m as unknown as { fog: boolean }).fog = false;
      (scene as unknown as { fogNode: unknown }).fogNode = uwFogNode;
    }
    const { under } = useSettings.getState();
    uwFogU.under.value = uw.blend;
    uwFogU.col.value.set(under.color);
    uwFogU.dens.value = under.density;
    const af = useSettings.getState().airFog;
    airFogU.on.value = af.on ? 1 : 0;
    airFogU.col.value.set(af.color);
    airFogU.near.value = Math.max(af.near, 0);
    airFogU.far.value = Math.max(af.far, af.near + 0.1);
    const oe = useSettings.getState().oceanEdge;
    oceanEdgeU.start.value = oe.start;
    oceanEdgeU.end.value = oe.end;
    uw.f++;
    if (UWDBG && uw.f === 1) Object.assign(window, { __cam: camera, __scene: scene, __uwo: uw, __uwFog: uwFogU, __gl: gl });
    if (UWLOG) {
      const now = performance.now(), dt = uw.last ? now - uw.last : 0; uw.last = now;
      const row = { f: uw.f, camY: +camera.position.y.toFixed(3), h: +hNow.toFixed(3), hAge: uw.hOk ? uw.f - uw.hF : -1, busy: !!probe.busy, cpuH: +sampleOceanY(camera.position.x, camera.position.z, oceanClock.t).toFixed(3), depth: +depth.toFixed(3), under: uw.under, uUnderG: ocean.uniforms.uUnderG.value, split: +split.toFixed(2), fog: uwFogU.under.value * uwFogU.dens.value, dt: +dt.toFixed(1) };
      Object.assign(window, { __uw: row, __cam: camera, __scene: scene, __uwo: uw, __uwFog: uwFogU, __gl: gl });
      if (Math.abs(depth) < 1.5 || uw.under !== uw.wasUnder || dt > 50) console.log("[uw]", JSON.stringify(row), dt > 50 ? "LONG FRAME" : "");
    }
    uw.wasUnder = uw.under;
    void rdt;
  }, -0.5);
  return (
    <>
      <Bubbles under={uwFogU.under} />
      <mesh ref={bgRef} geometry={uwBgGeo} material={uwBgMat} frustumCulled={false} renderOrder={-10} />
      <mesh geometry={geo} material={ocean} frustumCulled={false} position-y={oceanState.level} receiveShadow />
    </>
  );
}
