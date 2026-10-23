import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const open = () => {
  void browser.tabs.create({ url: browser.runtime.getURL("/history.html") });
  window.close();
};

const Popup = () => (
  <div className="p-4">
    <h1 className="text-lg font-semibold">Better History</h1>
    <button
      className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground mt-3 w-full rounded-md px-3 py-2 text-sm"
      onClick={open}
      type="button"
    >
      Open full history
    </button>
  </div>
);

const queryClient = new QueryClient();

const root = document.querySelector("#app");

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
