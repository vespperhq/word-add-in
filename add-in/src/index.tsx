import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");
const root = createRoot(rootEl);

Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) {
    rootEl.textContent = "This add-in only runs in Microsoft Word.";
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
