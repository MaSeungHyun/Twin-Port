import Viewport from "./views/viewport";

function App() {
  return (
    <main className="flex flex-col w-screen h-screen max-w-screen max-h-screen overflow-hidden bg-neutral-700">
      <Viewport />
    </main>
  );
}

export default App;
