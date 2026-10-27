// CPU sampleOceanHeight vs 셰이더 gerstner() 식 비교 (GLSL 식을 그대로 옮김)
import { buildWaves, HYBRID_DEFAULT, sampleOceanHeight } from "../src/views/viewport/_components/OceanTsl/hybrid/gerstner";
const ws = buildWaves(HYBRID_DEFAULT);
const W = ws.map((g) => [g.dx, g.dz, g.k, g.w]), A = ws.map((g) => [g.a, g.qa]);
function shader(x: number, z: number, t: number) { // vec3 gerstner(vec2 xz,float t)
  let dx = 0, dy = 0, dz = 0;
  for (let i = 0; i < 4; i++) { const th = W[i][2] * (W[i][0] * x + W[i][1] * z) - W[i][3] * t, c = Math.cos(th), s = Math.sin(th);
    dx += A[i][1] * W[i][0] * c; dy += A[i][0] * s; dz += A[i][1] * W[i][1] * c; }
  return [x + dx, dy, z + dz];
}
let max = 0;
for (const [x, z, t] of [[0, 0, 0], [123.4, -567.8, 3.2], [-2500, 1800, 17.5], [5000, 5000, 99.9], [37, 911, 42]]) {
  const [wx, wy, wz] = shader(x, z, t), cpu = sampleOceanHeight(wx, wz, t, ws), err = Math.abs(cpu - wy);
  max = Math.max(max, err);
  console.log(`rest(${x},${z}) t=${t} -> gpu y=${wy.toFixed(4)} cpu y=${cpu.toFixed(4)} err=${err.toExponential(2)}`);
}
console.log("max err", max.toExponential(2), max < 1e-2 ? "PASS" : "FAIL");
