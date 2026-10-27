// @ts-nocheck -- TSL 노드 체인 타이핑 예외 (oceanTSL.ts 참고)
// WebGL2 백엔드용 FFT 바다: 컴퓨트/스토리지/워크그룹 없이 풀스크린 프래그먼트 패스만 사용.
// 구 GLSL FFTOcean(evolve → Stockham 역 FFT 2·log2N 단계 → disp/deriv)을 TSL 로 1:1 포팅 → 결과 텍스처는 FFTOceanGPU 와 동일 포맷.
// 모든 읽기는 texture.load(정수 텍셀) — 렌더타깃 y-flip 은 three 가 load 에도 동일 적용하므로 두 백엔드 공통 좌표계.
import * as THREE from "three";
import { MeshBasicNodeMaterial, QuadMesh } from "three/webgpu";
import {
  Fn, float, int, vec2, vec4, ivec2, uniform, texture, screenCoordinate, step, length, max, sqrt, cos, sin,
  floor, exp, clamp, smoothstep, mix, mod, select,
} from "three/tsl";
import { buildSpectra, CASCADE_L, type OceanParams } from "../spectrum";
import type { OceanSim, UpdateMode } from "../fft";

const PI2 = 6.283185307;
const cmul = (a, b) => vec2(a.x.mul(b.x).sub(a.y.mul(b.y)), a.x.mul(b.y).add(a.y.mul(b.x)));
const pack = (a, b) => vec2(a.x.sub(b.y), a.y.add(b.x));
const rawRT = (N: number) =>
  new THREE.RenderTarget(N, N, {
    type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: false, generateMipmaps: false,
  });
const outRT = (N: number, aniso: number) =>
  new THREE.RenderTarget(N, N, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: true, anisotropy: aniso,
  });
const mat = (node) => {
  const m = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
  m.toneMapped = false;
  m.fragmentNode = node;
  return m;
};
const pix = () => ivec2(floor(screenCoordinate.xy)).toVar();

export class FFTOceanFrag implements OceanSim {
  N: number[];
  hs = 1;
  disp: THREE.RenderTarget[][] = [];
  deriv: THREE.RenderTarget[] = [];
  private h0: THREE.DataTexture[] = [];
  private A: THREE.RenderTarget[] = [];
  private B: THREE.RenderTarget[] = [];
  private ping: THREE.RenderTarget[] = [];
  private cur = [0, 0, 0];
  private lastT = [-1, -1, -1];
  private frame = 0;
  private quad = new QuadMesh();
  private uTime = uniform(0);
  private uLambda = uniform(1);
  private uFoamDecay = uniform(0.55);
  private uFoamThr = uniform(0.45);
  private uN = uniform(1);
  private uL = uniform(1);
  private uSub = uniform(2);
  private uHoriz = uniform(1);
  private uDt = uniform(0);
  private tH0 = texture(new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType));
  private tSrc = texture(new THREE.Texture());
  private tA = texture(new THREE.Texture());
  private tB = texture(new THREE.Texture());
  private tPrev = texture(new THREE.Texture());
  private evo: MeshBasicNodeMaterial[];
  private fftM: MeshBasicNodeMaterial;
  private dspM: MeshBasicNodeMaterial;
  private derM: MeshBasicNodeMaterial;

  constructor(Ns: number[], aniso: number) {
    this.N = Ns.slice(0, 3);
    for (let c = 0; c < 3; c++) {
      const N = this.N[c];
      const t = new THREE.DataTexture(new Float32Array(N * N * 4), N, N, THREE.RGBAFormat, THREE.FloatType);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.needsUpdate = true;
      this.h0.push(t);
      this.A.push(rawRT(N));
      this.B.push(rawRT(N));
      this.ping.push(rawRT(N));
      this.disp.push([outRT(N, aniso), outRT(N, aniso)]);
      this.deriv.push(outRT(N, aniso));
    }
    const { uN, uL, uTime, uSub, uHoriz, uLambda, uDt, uFoamThr, uFoamDecay } = this;
    // evolve: which=0 → A(Dx,h | Dz,Dyx), which=1 → B(Dyz,Dxx | Dzz,Dxz)
    this.evo = [0, 1].map((which) =>
      mat(Fn(() => {
        const pc = pix();
        const p = vec2(pc).toVar();
        const n = p.sub(step(uN.mul(0.5), p).mul(uN));
        const k = n.mul(PI2).div(uL).toVar();
        const kl = max(length(k), 1e-6).toVar();
        const w = sqrt(kl.mul(9.81));
        const hv = this.tH0.load(pc).toVar();
        const e = vec2(cos(w.mul(uTime)), sin(w.mul(uTime))).toVar();
        const h = cmul(hv.xy, e).add(cmul(hv.zw, vec2(e.x, e.y.negate()))).toVar();
        const ih = vec2(h.y.negate(), h.x).toVar();
        if (which === 0) return vec4(pack(ih.mul(k.x).div(kl), h), pack(ih.mul(k.y).div(kl), ih.mul(k.x)));
        return vec4(
          pack(ih.mul(k.y), h.negate().mul(k.x).mul(k.x).div(kl)),
          pack(h.negate().mul(k.y).mul(k.y).div(kl), h.negate().mul(k.x).mul(k.y).div(kl)),
        );
      })()),
    );
    // Stockham radix-2 한 단계 (RG/BA 두 복소 신호 동시)
    this.fftM = mat(Fn(() => {
      const pc = pix();
      const p = vec2(pc).toVar();
      const idx = mix(p.y, p.x, uHoriz).toVar();
      const hs = uSub.mul(0.5);
      const ev = floor(idx.div(uSub)).mul(hs).add(mod(idx, hs));
      const ce = mix(vec2(p.x, ev), vec2(ev, p.y), uHoriz).toVar();
      const co = ce.add(mix(vec2(0, uN.mul(0.5)), vec2(uN.mul(0.5), 0), uHoriz));
      const a = this.tSrc.load(ivec2(ce)).toVar();
      const b = this.tSrc.load(ivec2(co)).toVar();
      const ang = idx.mul(PI2).div(uSub);
      const tw = vec2(cos(ang), sin(ang)).toVar();
      return vec4(a.xy.add(cmul(tw, b.xy)), a.zw.add(cmul(tw, b.zw)));
    })());
    this.dspM = mat(Fn(() => {
      const pc = pix();
      const a = this.tA.load(pc).toVar(), b = this.tB.load(pc).toVar();
      const lam = uLambda;
      const J = float(1).add(lam.mul(b.y)).mul(float(1).add(lam.mul(b.z))).sub(lam.mul(lam).mul(b.w).mul(b.w));
      const inj = smoothstep(uFoamThr, uFoamThr.sub(0.45), J);
      const foam = clamp(max(this.tPrev.load(pc).w.mul(exp(uDt.negate().mul(uFoamDecay))), inj), 0.0, 1.0);
      return vec4(lam.mul(a.x), a.y, lam.mul(a.z), foam);
    })());
    this.derM = mat(Fn(() => {
      const pc = pix();
      const a = this.tA.load(pc).toVar(), b = this.tB.load(pc).toVar();
      return vec4(a.w, b.x, uLambda.mul(b.y), uLambda.mul(b.z));
    })());
    void int; void select;
  }
  setFoam(collFoam: number, persist: number) {
    this.uFoamThr.value = 0.45 + 0.25 * collFoam;
    this.uFoamDecay.value = 0.55 / Math.max(persist, 0.1);
  }
  setParams(p: OceanParams) {
    const byN = new Map<number, ReturnType<typeof buildSpectra>>();
    for (const N of this.N) if (!byN.has(N)) byN.set(N, buildSpectra(N, p));
    this.hs = byN.get(Math.max(...this.N))!.hs;
    this.N.forEach((N, c) => {
      (this.h0[c].image.data as Float32Array).set(byN.get(N)!.data[c]);
      this.h0[c].needsUpdate = true;
    });
    this.uLambda.value = p.choppy * 1.25;
  }
  private run(r, m: MeshBasicNodeMaterial, rt: THREE.RenderTarget) {
    this.quad.material = m;
    r.setRenderTarget(rt);
    this.quad.render(r);
  }
  update(r: any, time: number, _dt: number, mode: UpdateMode = "every", nth = 2) {
    const prevRT = r.getRenderTarget();
    const f = this.frame++;
    this.uTime.value = time;
    for (let c = 0; c < 3; c++) {
      const first = this.lastT[c] < 0;
      const due = first || mode === "every" || (mode === "alt" ? c === 2 || (f & 1) === c : f % Math.max(1, nth) === 0);
      if (!due) continue;
      this.uDt.value = first ? 0 : Math.min(time - this.lastT[c], 0.25);
      this.lastT[c] = time;
      const cur = (this.cur[c] = 1 - this.cur[c]);
      const N = this.N[c];
      this.uN.value = N;
      this.uL.value = CASCADE_L[c];
      this.tH0.value = this.h0[c];
      this.run(r, this.evo[0], this.A[c]);
      this.run(r, this.evo[1], this.B[c]);
      for (const tgt of [this.A[c], this.B[c]]) {
        let src = tgt, dst = this.ping[c];
        for (const h of [1, 0])
          for (let sub = 2; sub <= N; sub *= 2) {
            this.uHoriz.value = h;
            this.uSub.value = sub;
            this.tSrc.value = src.texture;
            this.run(r, this.fftM, dst);
            [src, dst] = [dst, src];
          }
        // 2·log2N 단계(짝수) → 결과는 tgt 로 복귀
      }
      this.tA.value = this.A[c].texture;
      this.tB.value = this.B[c].texture;
      this.tPrev.value = this.disp[c][1 - cur].texture;
      this.run(r, this.dspM, this.disp[c][cur]);
      this.run(r, this.derM, this.deriv[c]);
    }
    r.setRenderTarget(prevRT);
    return this.cur;
  }
  dispose() {
    [...this.h0, ...this.A, ...this.B, ...this.ping, ...this.disp.flat(), ...this.deriv].forEach((t) => t.dispose());
    [...this.evo, this.fftM, this.dspM, this.derM].forEach((m) => m.dispose());
  }
}
