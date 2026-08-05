import Scene from "./_components/Scene";

export default function Viewport() {
  return (
    <div className="relative flex flex-1 w-full h-full min-h-0">
      <Scene />
    </div>
  );
}
