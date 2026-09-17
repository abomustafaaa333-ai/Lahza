import { trpc } from "@/lib/trpc";
import { getAuthRuntimeId } from "@/lib/authRuntime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import "./admin-layout-fix.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 2,
      retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 5_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const headers = new Headers(init?.headers);
        headers.set("x-lahza-auth-runtime", getAuthRuntimeId());
        const selectedCity = window.sessionStorage.getItem("lahza_selected_city");
        if (selectedCity === "manbij" || selectedCity === "jarabulus") headers.set("x-lahza-city", selectedCity);
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include", headers });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
