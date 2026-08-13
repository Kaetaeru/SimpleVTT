import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/AppProvider";
import "./app/characterCreationV09Adapter";
import "./app/mockAdapterCompletion";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./character-creation-v09.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
