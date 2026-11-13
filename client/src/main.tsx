import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";

// Self-hosted variable fonts (no third-party font request): Rubik for body
// copy and controls, Nunito for headings.
import "@fontsource-variable/rubik";
import "@fontsource-variable/nunito";
import "./styles/globals.css";

import { AppRoutes } from "./app/routes";
import { AppToaster } from "./components/theme/app-toaster";
import { installAuthInterceptor } from "./lib/auth-interceptor";
import { queryClient } from "./lib/query-client";

installAuthInterceptor();

// After a deploy, a tab still running the previous build asks for lazy page
// chunks whose hashed files no longer exist. Reload once to pick up the new
// build; the timestamp guard stops a reload loop if the chunk is truly gone.
window.addEventListener("vite:preloadError", (event) => {
  const key = "chunk-reload-at";
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage unavailable: still reload once for this page view.
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <AppToaster />
    </QueryClientProvider>
  </StrictMode>,
);
