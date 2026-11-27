import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import "./theme.css";
import { App } from "./App";
import { Blog } from "./Blog";
import { isWhiteLabel } from "./brand";

const blogPath = window.location.pathname.replace(/\/$/, "") || "/";
// White-label builds have no blog; the constant lets the bundler drop it.
const isBlogRoute =
  !isWhiteLabel && (blogPath === "/blog" || blogPath.startsWith("/blog/"));
const blogSlug = blogPath.startsWith("/blog/")
  ? blogPath.slice("/blog/".length)
  : undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isBlogRoute ? <Blog slug={blogSlug} /> : <App />}
  </React.StrictMode>,
);
