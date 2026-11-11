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
