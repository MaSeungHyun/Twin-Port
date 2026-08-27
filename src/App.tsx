import Header from "./views/View/header";
import ViewLoader from "./views/View/ViewLoader";
import Viewport from "./views/viewport";
import MonitoringOverlay from "./views/viewport/_components/MonitoringOverlay";
import Toaster from "@/components/Toaster";

function App() {
  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-700">
      <ViewLoader />
      <Header />
      <Viewport />
      <MonitoringOverlay />
      <Toaster />
    </main>
  );
}

export default App;
