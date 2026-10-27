import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { skyState } from "../spectrum";
import { useSettingsEffect } from "../state/useSettingsEffect";
import { useSettings } from "../state/settingsStore";
import { countRender } from "../dev/renderCount";
import { PRI, useScene } from "./context";
import { oceanClock, oceanState, sampleOceanY } from "../oceanApi";
import * as THREE_U from "three";

// [twin-port] 수중 판정 (원본 HeightProbe 대체: CPU 수면 샘플) + 장면 안개
const uw = { under: false, blend: 0, fog: new THREE_U.FogExp2(0x0f7f86, 0.09), col: new THREE_U.Color(), prevFog: null as THREE_U.Fog | THREE_U.FogExp2 | null, prevBg: null as unknown, active: false };

// [twin-port] 셰이더는 수면 로컬(y=0) 좌표 → 카메라를 level 만큼 내려서 전달, 메시는 level 만큼 올림
const camL = new THREE.Vector3();

export function Ocean({ geo }: { geo: THREE.BufferGeometry }) {
  countRender("scene.ocean");
  const { sim, ocean, sky, island } = useScene();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
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
    camL.copy(camera.position);
    camL.y -= oceanState.level;
    island.uniforms.uCam.value.copy(camL);
    u.uCam.value.copy(camL);
    u.uCamV.value.copy(camL);
    sky.uniforms.uCam.value.copy(camL);
    u.uOffset.value.set(camera.position.x, camera.position.z);
    // 수중: 카메라가 실제 파면 아래(히스테리시스 6cm)면 uUnderG → 바다/하늘 셰이더 수중 모드 + 장면 지수안개
    const depth = oceanState.visible ? sampleOceanY(camera.position.x, camera.position.z, t) - camera.position.y : -1;
    if (!uw.under && depth > 0.06) uw.under = true;
    else if (uw.under && depth < -0.06) uw.under = false;
    uw.blend += ((uw.under ? 1 : 0) - uw.blend) * Math.min(1, rdt * 10);
    u.uUnderG.value = sky.uniforms.uUnderG.value = island.uniforms.uUnderG.value = uw.blend;
    const on = uw.blend > 0.5;
    if (on !== uw.active) {
      uw.active = on;
      if (on) { uw.prevFog = scene.fog; uw.prevBg = scene.background; scene.fog = uw.fog; }
      else { scene.fog = uw.prevFog; scene.background = uw.prevBg as THREE_U.Color | null; }
    }
    if (on) {
      const { under } = useSettings.getState();
      uw.col.set(under.color).multiplyScalar(0.6);
      uw.fog.color.copy(uw.col);
      uw.fog.density = under.density * 0.5;
      scene.background = uw.fog.color;
    }
  }, PRI.ocean);
  return <mesh geometry={geo} material={ocean} frustumCulled={false} position-y={oceanState.level} receiveShadow />;
}
