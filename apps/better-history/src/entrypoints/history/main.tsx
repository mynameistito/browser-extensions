import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "@/routeTree.gen";

const getInitialEntry = (): string => {
  const hash = window.location.hash.replace(/^#/u, "");
  return hash.length > 0 ? hash : "/";
};

const router = createRouter({
  defaultPreload: "intent",
  history: createMemoryHistory({ initialEntries: [getInitialEntry()] }),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient();

const root = document.querySelector("#app");
if (!root) {
  throw new Error("Root element #app not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
