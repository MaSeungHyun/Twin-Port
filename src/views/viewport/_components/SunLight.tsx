export default function SunLight() {
  return (
    <directionalLight
      position={[0.89004, 9.637, -7.7129]}
      quaternion={[0.384, -0.028, -0.807, 0.447]}
      intensity={0.0001}
      color={0xffffff}
      // castShadow
      // shadow-mapSize={[4096, 4096]}
      // shadow-bias={-0.00015}
      // shadow-normalBias={0.04}
      // shadow-radius={1}
      // shadow-camera-near={0.2}
      // shadow-camera-far={80}
      // // 야드 크기에 맞춘 ortho frustum — 너무 넓으면 그림자가 흐려짐
      // shadow-camera-left={-18}
      // shadow-camera-right={18}
      // shadow-camera-top={28}
      // shadow-camera-bottom={-28}
    />
  );
}
