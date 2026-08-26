import Header from "./views/View/header";
import ViewLoader from "./views/View/ViewLoader";
import Viewport from "./views/viewport";
import MonitoringOverlay from "./views/viewport/_components/MonitoringOverlay";

function App() {
  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-700">
      <ViewLoader />
      <Header />
      <Viewport />
      <MonitoringOverlay />
    </main>
  );
}

export default App;
