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
  uniforms: { time: { value: number } };
};

export default function Water() {
  const ref = useRef<Mesh>(null);

  const loadedNormals = useLoader(TextureLoader, "/waternormals.jpg");

  const water = useMemo(() => {
    const waterNormals = loadedNormals.clone();
    waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

    const geometry = new PlaneGeometry(10000, 10000);
    const instance = new ThreeWater(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new Vector3(0.70707, 0.70707, 0),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: false,
    });
    instance.rotation.x = -Math.PI / 2;
    return instance;
  }, [loadedNormals]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    (ref.current.material as WaterMaterial).uniforms.time.value += delta;
  });

  return <primitive ref={ref} object={water} />;
}
