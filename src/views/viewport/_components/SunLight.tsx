export default function SunLight() {
  return (
    <directionalLight
      position={[10, 120, 20]}
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
    />
  );
}
