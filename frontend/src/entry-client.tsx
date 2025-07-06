import "./index.css";
import React, { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement)
  throw new Error("Root element not found - are we in the browser?");

hydrateRoot(
  rootElement,
  <StrictMode>
    <App />
  </StrictMode>,
);
