import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ClientProvider } from "./app/context";
import "./ui/tokens.css";
import "./ui/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientProvider>
      <App />
    </ClientProvider>
  </StrictMode>,
);
