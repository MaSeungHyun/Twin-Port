export default function SunLight() {
  return (
    <directionalLight
      position={[2, 24, 4]}
      intensity={1.6}
      color={0xffffff}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.00015}
      shadow-normalBias={0.04}
      shadow-radius={1}
      shadow-camera-near={0.2}
      shadow-camera-far={80}
      // 야드 크기에 맞춘 ortho frustum — 너무 넓으면 그림자가 흐려짐
      shadow-camera-left={-18}
      shadow-camera-right={18}
      shadow-camera-top={28}
      shadow-camera-bottom={-28}
    />
  );
}
