import asphalt from "@/assets/image/asphalt.png";
import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { RepeatWrapping, TextureLoader } from "three";
import { GROUND_X, GROUND_Y, GROUND_Z, TILE_SIZE } from "@/constants/ground";

export default function Ground() {
  const loadedTexture = useLoader(TextureLoader, asphalt);

  const texture = useMemo(() => {
    const map = loadedTexture.clone();
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(GROUND_X / TILE_SIZE, GROUND_Z / TILE_SIZE);
    map.needsUpdate = true;
    return map;
  }, [loadedTexture]);

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[GROUND_X, GROUND_Y, GROUND_Z]} />
      <meshStandardMaterial map={texture} roughness={1} metalness={0} />
    </mesh>
  );
}
