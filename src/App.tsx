import Header from "./views/View/header";
import Viewport from "./views/viewport";

function App() {
  return (
    <main className="flex h-full w-full flex-col overflow-hidden bg-neutral-700">
      <Header />
      <Viewport />
    </main>
  );
}

export default App;
