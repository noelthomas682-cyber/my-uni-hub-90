import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://3a7480098a840b8e38111b2df966eb3d@o4511281220943872.ingest.us.sentry.io/4511281228414976",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
