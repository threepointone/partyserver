import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import "./index.css";

function assert<T>(
  predicate: T,
  message: string
): asserts predicate is NonNullable<T> {
  if (!predicate) {
    throw new Error(message);
  }
}

const root = document.getElementById("root");
assert(root, "No root element found");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
