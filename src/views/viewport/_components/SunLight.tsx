import { DECK_Y } from "@/constants/container";
import { useRef } from "react";
import { DirectionalLight } from "three";

export default function SunLight() {
  const lightRef = useRef<DirectionalLight>(null);

  return (
    <directionalLight
      ref={lightRef}
      position={[100, 120, 40]}
      intensity={1.6}
      color={0xffffff}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.00015}
      shadow-normalBias={0.04}
      shadow-radius={1}
      shadow-camera-near={1}
      shadow-camera-far={400}
      // 야드 크기에 맞춘 ortho frustum — 너무 넓으면 그림자가 흐려짐
      shadow-camera-left={-90}
      shadow-camera-right={90}
      shadow-camera-top={140}
      shadow-camera-bottom={-140}
    >
      {/* 그림자 중심을 데크(야드)로 */}
      {/* <object3D attach="target" position={[0, DECK_Y, 0]} /> */}
    </directionalLight>
  );
}
