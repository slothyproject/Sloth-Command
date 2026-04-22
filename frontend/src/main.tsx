import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { App } from "./App";
import "./styles.css";

const CANONICAL_HOST = "dissident.mastertibbles.co.uk";
const LEGACY_HOSTS = new Set(["dissidenthub.mastertibbles.co.uk"]);

if (typeof window !== "undefined" && LEGACY_HOSTS.has(window.location.hostname)) {
  const canonicalPath = window.location.pathname.startsWith("/app")
    ? "/dashboard"
    : window.location.pathname;
  const canonicalUrl = `${window.location.protocol}//${CANONICAL_HOST}${canonicalPath}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <App />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);