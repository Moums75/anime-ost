import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { LibraryProvider } from "./library";
import { PlayerProvider } from "./player";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LibraryProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </LibraryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
