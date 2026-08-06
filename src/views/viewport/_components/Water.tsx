import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  PlaneGeometry,
  RepeatWrapping,
  TextureLoader,
  type Mesh,
  Vector3,
} from "three";
import { Water as ThreeWater } from "three/addons/objects/Water.js";

type WaterMaterial = ThreeWater["material"] & {
  uniforms: {
    time: { value: number };
    size: { value: number };
  };
};

type WaterProps = {
  /** 노멀맵 샘플링 크기. 클수록 물결이 더 촘촘해집니다. */
  size?: number;
};

export default function Water({ size = 5 }: WaterProps) {
  const ref = useRef<Mesh>(null);

  const loadedNormals = useLoader(TextureLoader, "/waternormals.jpg");

  const water = useMemo(() => {
    const waterNormals = loadedNormals.clone();
    waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

    const geometry = new PlaneGeometry(10000, 10000);
    const instance = new ThreeWater(geometry, {
      textureWidth: 256,
      textureHeight: 256,
      waterNormals,
      sunDirection: new Vector3(0.70707, 0.70707, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e3f,
      distortionScale: 0.1,
      fog: false,
    });
    (instance.material as WaterMaterial).uniforms.size.value = size;
    instance.rotation.x = -Math.PI / 2;
    return instance;
  }, [loadedNormals, size]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    (ref.current.material as WaterMaterial).uniforms.time.value += delta / 3;
  });

  return <primitive ref={ref} object={water} />;
}
