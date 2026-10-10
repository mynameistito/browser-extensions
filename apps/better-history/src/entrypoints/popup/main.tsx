import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const open = () => {
    browser.tabs.create({ url: browser.runtime.getURL("/history.html") });
    window.close();
  };
  return (
    <div className="p-4">
      <h1 className="font-semibold text-lg">Better History</h1>
      <button
        className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        onClick={open}
        type="button"
      >
        Open full history
      </button>
    </div>
  );
}

const queryClient = new QueryClient();

const root = document.getElementById("app");
if (!root) {
  throw new Error("Root element #app not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Popup />
    </QueryClientProvider>
  </StrictMode>
);
