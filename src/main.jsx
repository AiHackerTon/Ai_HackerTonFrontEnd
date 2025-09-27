import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import SafeKakaoProvider from "./SafeKakaoProvider.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(

    <App />

);
