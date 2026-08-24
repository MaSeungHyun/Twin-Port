import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { Water as ThreeWater } from "three/addons/objects/Water.js";
import { SHIP_SCALE } from "@/constants/model";
import {
  OCEAN_HEIGHT_SCALE,
  OCEAN_HULL_HALF_HEIGHT,
  OCEAN_HULL_HALF_LEN,
  OCEAN_HULL_HALF_WIDTH,
  OCEAN_HULL_Y,
  OCEAN_MOVE_THRESHOLD,
  OCEAN_PLANE_SEGMENTS,
  OCEAN_PLANE_SIZE,
  OCEAN_POSITION_Y,
  OCEAN_SHIP_MAX,
  OCEAN_SIM_EXTENT,
  OCEAN_SIM_SIZE,
  OCEAN_SIM_STEPS,
  OCEAN_TELEPORT_THRESHOLD,
  OCEAN_WAKE_DISTORT,
  OCEAN_WAKE_FOAM,
  OCEAN_WAKE_MIN_SCALE,
  OCEAN_WAKE_STRENGTH,
} from "@/constants/ocean";
import { HeightfieldWater } from "@/domain/heightfieldWater";
import { forEachShip } from "@/domain/shipWake";
import { bindHeightTexture, waterSimUniforms } from "@/domain/waterSim";
import { injectHeightfield } from "./waterHeightfieldShader";

type WaterMaterial = ThreeWater["material"] & {
  uniforms: {
    time: { value: number };
    size: { value: number };
    distortionScale: { value: number };
    tHeight: { value: unknown };
    tLand: { value: unknown };
    uHeightScale: { value: number };
    uSimExtent: { value: number };
    uWakeDistort: { value: number };
    uWakeFoam: { value: number };
  };
  vertexShader: string;
  fragmentShader: string;
};

type WaterUserData = {
  sim: HeightfieldWater;
};

type WaterProps = {
  size?: number;
};

export default function Water({ size = 5 }: WaterProps) {
  const meshRef = useRef<Mesh>(null);
  const lastX = useRef<number[]>([]);
  const lastZ = useRef<number[]>([]);
  const gl = useThree((state) => state.gl);
  const loadedNormals = useLoader(TextureLoader, "/waternormals.jpg");

  const water = useMemo(() => {
    const sim = new HeightfieldWater(gl, OCEAN_SIM_SIZE);
    const waterNormals = loadedNormals.clone();
    waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

    const geometry = new PlaneGeometry(
      OCEAN_PLANE_SIZE,
      OCEAN_PLANE_SIZE,
      OCEAN_PLANE_SEGMENTS,
      OCEAN_PLANE_SEGMENTS,
    );
    const instance = new ThreeWater(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new Vector3(0.50707, 0.20707, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e4f,
      // distortionScale: OCEAN_CALM_DISTORT,
      distortionScale: 0,
      fog: true,
    });

    const material = instance.material as WaterMaterial;
    const injected = injectHeightfield(
      material.vertexShader,
      material.fragmentShader,
    );
    material.uniforms.size.value = size;
    material.uniforms.time.value = 0;
    // material.uniforms.distortionScale.value = OCEAN_CALM_DISTORT;
    material.uniforms.distortionScale.value = 0;
    material.uniforms.tHeight = { value: sim.texture };
    material.uniforms.tLand = waterSimUniforms.tLand;
    material.uniforms.uHeightScale = { value: OCEAN_HEIGHT_SCALE };
    material.uniforms.uSimExtent = { value: OCEAN_SIM_EXTENT };
    material.uniforms.uWakeDistort = { value: OCEAN_WAKE_DISTORT };
    material.uniforms.uWakeFoam = { value: OCEAN_WAKE_FOAM };
    material.vertexShader = injected.vertex;
    material.fragmentShader = injected.fragment;
    material.needsUpdate = true;
    instance.rotation.x = -Math.PI / 2;
    instance.position.y = OCEAN_POSITION_Y;
    instance.userData.sim = sim;
    return instance;
  }, [gl, loadedNormals, size]);

  useEffect(() => {
    return () => {
      const sim = (water.userData as WaterUserData).sim;
      sim.dispose();
      water.geometry.dispose();
      (water.material as WaterMaterial).dispose();
    };
  }, [water]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh?.visible) return;
    const sim = (mesh.userData as WaterUserData).sim;
    const material = mesh.material as WaterMaterial;

    const uniforms = sim.hullUniforms;
    const oldPos = uniforms.uOldPos.value as Vector2[];
    const newPos = uniforms.uNewPos.value as Vector2[];
    const fwd = uniforms.uFwd.value as Vector2[];
    const halfLen = uniforms.uHalfLen.value as Float32Array;
    const halfWidth = uniforms.uHalfWidth.value as Float32Array;
    const centerY = uniforms.uCenterY.value as Float32Array;
    const halfH = uniforms.uHalfH.value as Float32Array;
    const strength = uniforms.uStrength.value as Float32Array;
    strength.fill(0);

    let count = 0;
    forEachShip((ship) => {
      if (ship.index >= OCEAN_SHIP_MAX) return;
      count = Math.max(count, ship.index + 1);
      if (ship.scale < OCEAN_WAKE_MIN_SCALE) {
        lastX.current[ship.index] = ship.x;
        lastZ.current[ship.index] = ship.z;
        return;
      }

      const prevX = lastX.current[ship.index];
      const prevZ = lastZ.current[ship.index];
      const hull = Math.max(ship.scale / SHIP_SCALE, 0.6);
      const simX = ship.x / OCEAN_SIM_EXTENT;
      const simZ = ship.z / OCEAN_SIM_EXTENT;
      const yawFwdX = Math.cos(ship.yaw);
      const yawFwdZ = -Math.sin(ship.yaw);

      newPos[ship.index]?.set(simX, simZ);
      fwd[ship.index]?.set(yawFwdX, yawFwdZ);
      halfLen[ship.index] = (OCEAN_HULL_HALF_LEN * hull) / OCEAN_SIM_EXTENT;
      halfWidth[ship.index] = (OCEAN_HULL_HALF_WIDTH * hull) / OCEAN_SIM_EXTENT;
      centerY[ship.index] = OCEAN_HULL_Y / OCEAN_SIM_EXTENT;
      halfH[ship.index] = OCEAN_HULL_HALF_HEIGHT / OCEAN_SIM_EXTENT;

      if (prevX === undefined || prevZ === undefined) {
        oldPos[ship.index]?.set(simX, simZ);
        lastX.current[ship.index] = ship.x;
        lastZ.current[ship.index] = ship.z;
        return;
      }

      const moved = Math.hypot(ship.x - prevX, ship.z - prevZ);
      oldPos[ship.index]?.set(
        prevX / OCEAN_SIM_EXTENT,
        prevZ / OCEAN_SIM_EXTENT,
      );
      lastX.current[ship.index] = ship.x;
      lastZ.current[ship.index] = ship.z;

      if (moved < OCEAN_MOVE_THRESHOLD || moved > OCEAN_TELEPORT_THRESHOLD) {
        oldPos[ship.index]?.set(simX, simZ);
        return;
      }

      strength[ship.index] = OCEAN_WAKE_STRENGTH;
    });

    uniforms.uCount.value = count;
    sim.displaceHulls();
    for (let i = 0; i < OCEAN_SIM_STEPS; i++) {
      sim.stepSimulation();
    }
    sim.updateNormals();

    bindHeightTexture(sim.texture);
    material.uniforms.tHeight.value = sim.texture;
    material.uniforms.uHeightScale.value = OCEAN_HEIGHT_SCALE;
    material.uniforms.uSimExtent.value = OCEAN_SIM_EXTENT;
    material.uniforms.uWakeDistort.value = OCEAN_WAKE_DISTORT;
    material.uniforms.uWakeFoam.value = OCEAN_WAKE_FOAM;
  });

  return <primitive ref={meshRef} object={water} />;
}
