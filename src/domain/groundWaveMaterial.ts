import {
  Mesh,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { waterSimUniforms } from "./waterSim";

function injectGroundWaves(shader: WebGLProgramParametersWithUniforms) {
  shader.uniforms.tHeight = waterSimUniforms.tHeight;
  shader.uniforms.tLand = waterSimUniforms.tLand;
  shader.uniforms.uSimExtent = waterSimUniforms.uSimExtent;
  shader.uniforms.uShoreFoam = waterSimUniforms.uShoreFoam;
  shader.uniforms.uShoreWet = waterSimUniforms.uShoreWet;
  shader.uniforms.uShoreReflect = waterSimUniforms.uShoreReflect;
  shader.uniforms.uShoreWidth = waterSimUniforms.uShoreWidth;
  shader.uniforms.uLandTexel = waterSimUniforms.uLandTexel;

  if (!shader.vertexShader.includes("vWaveWorld")) {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
#include <common>
varying vec3 vWaveWorld;
`,
      )
      .replace(
        "#include <project_vertex>",
        /* glsl */ `
#include <project_vertex>
vWaveWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`,
      );
  }

  if (!shader.fragmentShader.includes("uShoreWidth")) {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `
#include <common>
uniform sampler2D tHeight;
uniform sampler2D tLand;
uniform float uSimExtent;
uniform float uShoreFoam;
uniform float uShoreWet;
uniform float uShoreReflect;
uniform float uShoreWidth;
uniform vec2 uLandTexel;
varying vec3 vWaveWorld;
`,
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
#include <opaque_fragment>
{
  vec2 huv = vWaveWorld.xz / (2.0 * uSimExtent) + 0.5;
  float inSim = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
  if (inSim > 0.5) {
    vec2 texel = uLandTexel;
    vec2 span = texel * max(uShoreWidth, 1.0);
    float land = texture2D(tLand, huv).r;
    float landAvg = (
      texture2D(tLand, huv + vec2(span.x, 0.0)).r +
      texture2D(tLand, huv - vec2(span.x, 0.0)).r +
      texture2D(tLand, huv + vec2(0.0, span.y)).r +
      texture2D(tLand, huv - vec2(0.0, span.y)).r +
      texture2D(tLand, huv + span).r +
      texture2D(tLand, huv - span).r +
      texture2D(tLand, huv + vec2(span.x, -span.y)).r +
      texture2D(tLand, huv + vec2(-span.x, span.y)).r
    ) * 0.125;
    float shore = land * (1.0 - landAvg);
    float wave = abs(texture2D(tHeight, huv).r);
    wave = max(wave, abs(texture2D(tHeight, huv + vec2(span.x, 0.0)).r));
    wave = max(wave, abs(texture2D(tHeight, huv - vec2(span.x, 0.0)).r));
    wave = max(wave, abs(texture2D(tHeight, huv + vec2(0.0, span.y)).r));
    wave = max(wave, abs(texture2D(tHeight, huv - vec2(0.0, span.y)).r));
    float splash = clamp(wave * 5.5, 0.0, 1.0);
    float hit = shore * splash;
    vec3 wet = gl_FragColor.rgb * (1.0 - uShoreWet * 0.75);
    vec3 bounce = mix(vec3(0.05, 0.18, 0.32), vec3(0.85, 0.95, 1.0), splash);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wet, hit * uShoreWet);
    gl_FragColor.rgb += bounce * hit * uShoreReflect;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.97, 1.0), hit * uShoreFoam);
  }
}
`,
      );
  }
}

export function enableGroundWaveResponse(root: Object3D) {
  const seen = new Set<Material>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const list = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of list) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      const prevCompile = material.onBeforeCompile;
      material.onBeforeCompile = (
        shader: WebGLProgramParametersWithUniforms,
        renderer: WebGLRenderer,
      ) => {
        prevCompile?.(shader, renderer);
        injectGroundWaves(shader);
      };
      const prevKey = material.customProgramCacheKey;
      material.customProgramCacheKey = function customGroundWaveKey() {
        return `${prevKey.call(this)}-ground-wave-v2`;
      };
      material.needsUpdate = true;
    }
  });
}
