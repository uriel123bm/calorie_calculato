import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { AuthProvider } from "./context/AuthContext";
import { registerServiceWorkerLifecycle } from "./registerSwLifecycle";
import "./styles/App.css";

registerServiceWorkerLifecycle();

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1"),
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <PwaUpdatePrompt />
    </AuthProvider>
  </React.StrictMode>
);
