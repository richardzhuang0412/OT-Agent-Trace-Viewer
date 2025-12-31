import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.error("[Client Error]", event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Client Unhandled Rejection]", event.reason);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
