import Header from "./views/View/header";
import ViewLoader from "./views/View/ViewLoader";
import Viewport from "./views/viewport";
import OccupancyOverlay from "./views/viewport/_components/OccupancyOverlay";

function App() {
  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-700">
      <ViewLoader />
      <Header />
      <Viewport />
      <OccupancyOverlay />
    </main>
  );
}

export default App;
