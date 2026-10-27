// [twin-port TSL 통일] WebGL GLSL FFT(FFTOcean) 제거 → webgpu/fftGPU.ts (컴퓨트) 만 사용. 공통 타입만 유지
import type * as THREE from 'three'
import type { OceanParams } from './spectrum'

export type UpdateMode = 'every' | 'alt' | 'nth'
// WebGL(FFTOcean) / WebGPU(FFTOceanGPU) 공통 인터페이스
export interface OceanSim {
  N: number[]; hs: number
  disp: { texture: THREE.Texture }[][]; deriv: { texture: THREE.Texture }[]
  setFoam(collFoam: number, persist: number): void
  setParams(p: OceanParams): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(r: any, time: number, dt: number, mode?: UpdateMode, nth?: number): number[]
  dispose(): void
}
