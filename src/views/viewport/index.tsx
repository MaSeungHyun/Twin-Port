import Toaster from "@/components/Toaster";
import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import ContentsLayer from "./_components/ContentsLayer";
import Scene from "./_components/Scene";

export default function Viewport() {
  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden border border-primary">
      <Scene />
      <ContentsLayer />
      <div className="pointer-events-none absolute inset-0 z-1 bg-transparent shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]" />
      <Toaster />
      <ToasterTestTrigger />
    </div>
  );
}
