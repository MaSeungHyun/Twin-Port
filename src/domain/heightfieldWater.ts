import {
  ClampToEdgeWrapping,
  Color,
  FloatType,
  HalfFloatType,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import {
  OCEAN_SHIP_MAX,
  OCEAN_WALL_BOUNCE,
  OCEAN_WAVE_DAMPING,
  OCEAN_WAVE_SPEED,
} from "@/constants/ocean";
import { waterSimUniforms } from "./waterSim";
import {
  HULL_DISPLACE_FRAG,
  SIM_QUAD_VERT,
  WATER_NORMAL_FRAG,
  WAVE_SIM_FRAG,
} from "./heightfieldShaders";

function makeVec2Array(count: number) {
  return Array.from({ length: count }, () => new Vector2());
}

/**
 * jeantimex/threejs-water GPU 높이장 파동 시뮬.
 * https://github.com/jeantimex/threejs-water
 */
export class HeightfieldWater {
  readonly textureA: WebGLRenderTarget;
  readonly textureB: WebGLRenderTarget;

  private readonly renderer: WebGLRenderer;
  private readonly camera: OrthographicCamera;
  private readonly scene: Scene;
  private readonly plane: Mesh;
  private readonly waveMaterial: ShaderMaterial;
  private readonly normalMaterial: ShaderMaterial;
  private readonly hullMaterial: ShaderMaterial;
  private readonly viewport = new Vector4();
  private readonly clearColor = new Color();
  private swapped = false;

  constructor(renderer: WebGLRenderer, size: number) {
    this.renderer = renderer;

    const type =
      renderer.capabilities.isWebGL2 &&
      renderer.extensions.has("EXT_color_buffer_float")
        ? FloatType
        : HalfFloatType;

    const options = {
      type,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: RGBAFormat,
      stencilBuffer: false,
      depthBuffer: false,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      colorSpace: NoColorSpace,
    } as const;

    this.textureA = new WebGLRenderTarget(size, size, options);
    this.textureB = new WebGLRenderTarget(size, size, options);
    this.textureA.texture.colorSpace = NoColorSpace;
    this.textureB.texture.colorSpace = NoColorSpace;

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new Scene();
    const geometry = new PlaneGeometry(2, 2);
    const delta = new Vector2(1 / size, 1 / size);

    this.waveMaterial = new ShaderMaterial({
      vertexShader: SIM_QUAD_VERT,
      fragmentShader: WAVE_SIM_FRAG,
      uniforms: {
        tInput: { value: null },
        tLand: waterSimUniforms.tLand,
        delta: { value: delta.clone() },
        poolWidth: { value: 1 },
        poolLength: { value: 1 },
        uWallBounce: { value: OCEAN_WALL_BOUNCE },
        uDamping: { value: OCEAN_WAVE_DAMPING },
        uWaveSpeed: { value: OCEAN_WAVE_SPEED },
      },
    });

    this.normalMaterial = new ShaderMaterial({
      vertexShader: SIM_QUAD_VERT,
      fragmentShader: WATER_NORMAL_FRAG,
      uniforms: {
        tInput: { value: null },
        tLand: waterSimUniforms.tLand,
        delta: { value: delta.clone() },
        poolWidth: { value: 1 },
        poolLength: { value: 1 },
      },
    });

    this.hullMaterial = new ShaderMaterial({
      vertexShader: SIM_QUAD_VERT,
      fragmentShader: HULL_DISPLACE_FRAG,
      uniforms: {
        tInput: { value: null },
        tLand: waterSimUniforms.tLand,
        uOldPos: { value: makeVec2Array(OCEAN_SHIP_MAX) },
        uNewPos: { value: makeVec2Array(OCEAN_SHIP_MAX) },
        uFwd: { value: makeVec2Array(OCEAN_SHIP_MAX) },
        uHalfLen: { value: new Float32Array(OCEAN_SHIP_MAX) },
        uHalfWidth: { value: new Float32Array(OCEAN_SHIP_MAX) },
        uCenterY: { value: new Float32Array(OCEAN_SHIP_MAX) },
        uHalfH: { value: new Float32Array(OCEAN_SHIP_MAX) },
        uStrength: { value: new Float32Array(OCEAN_SHIP_MAX) },
        uCount: { value: 0 },
      },
    });

    this.plane = new Mesh(geometry, this.waveMaterial);
    this.scene.add(this.plane);
    this.clearTextures();
  }

  get texture() {
    return this.swapped ? this.textureB.texture : this.textureA.texture;
  }

  get hullUniforms() {
    return this.hullMaterial.uniforms;
  }

  displaceHulls() {
    this.blit(this.hullMaterial);
  }

  stepSimulation() {
    this.blit(this.waveMaterial);
  }

  updateNormals() {
    this.blit(this.normalMaterial);
  }

  dispose() {
    this.textureA.dispose();
    this.textureB.dispose();
    this.waveMaterial.dispose();
    this.normalMaterial.dispose();
    this.hullMaterial.dispose();
    this.plane.geometry.dispose();
  }

  private readTarget() {
    return this.swapped ? this.textureB : this.textureA;
  }

  private writeTarget() {
    return this.swapped ? this.textureA : this.textureB;
  }

  private blit(material: ShaderMaterial) {
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevXr = renderer.xr.enabled;
    renderer.getViewport(this.viewport);
    renderer.getClearColor(this.clearColor);
    const prevAlpha = renderer.getClearAlpha();

    material.uniforms.tInput.value = this.readTarget().texture;
    if (material.uniforms.tLand) {
      material.uniforms.tLand.value = waterSimUniforms.tLand.value;
    }
    this.plane.material = material;

    renderer.xr.enabled = false;
    renderer.autoClear = true;
    renderer.setViewport(0, 0, this.textureA.width, this.textureA.height);
    renderer.setRenderTarget(this.writeTarget());
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(this.viewport);
    renderer.autoClear = prevAutoClear;
    renderer.xr.enabled = prevXr;
    renderer.setClearColor(this.clearColor, prevAlpha);
    this.swapped = !this.swapped;
  }

  private clearTextures() {
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(this.clearColor);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.textureA);
    renderer.clear();
    renderer.setRenderTarget(this.textureB);
    renderer.clear();
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(this.clearColor, prevAlpha);
  }
}
