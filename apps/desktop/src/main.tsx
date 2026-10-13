import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { MainWindow } from "./windows/Main";
import { OverlayWindow } from "./windows/Overlay";

const isOverlay = window.location.hash === "#overlay";
document.body.classList.add(isOverlay ? "overlay" : "main");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isOverlay ? <OverlayWindow /> : <MainWindow />}</React.StrictMode>,
);
