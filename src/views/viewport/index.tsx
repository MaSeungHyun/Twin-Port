import Toaster from "@/components/Toaster";
import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import Scene from "./_components/Scene";
import ContainerSearch from "./_components/ContainerSearch";

export default function Viewport() {
  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden border border-primary">
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <ContainerSearch />
      </div>
      <Scene />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]" />
      <Toaster />
      <ToasterTestTrigger />
    </div>
  );
}
