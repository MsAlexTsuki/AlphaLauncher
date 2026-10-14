import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import App from "./App";
import { supabase } from "./lib/supabase";
import "./community-friends.css";

async function handleAuthDeepLink(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "alphaclient:" || url.hostname !== "auth" || url.pathname !== "/callback") {
      return;
    }

    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const accessToken = fragment.get("access_token") ?? url.searchParams.get("access_token");
    const refreshToken = fragment.get("refresh_token") ?? url.searchParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return;
    }

    const code = url.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }

    const callbackError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (callbackError) {
      console.error("Alpha Account email confirmation failed:", callbackError);
    }
  } catch (error) {
    console.error("Could not complete Alpha Account email confirmation:", error);
  }
}

async function initializeDeepLinks() {
  try {
    await onOpenUrl((urls) => {
      for (const url of urls) void handleAuthDeepLink(url);
    });

    const currentUrls = await getCurrent();
    if (currentUrls) {
      for (const url of currentUrls) void handleAuthDeepLink(url);
    }
  } catch (error) {
    console.error("Could not initialize AlphaLauncher deep links:", error);
  }
}

void initializeDeepLinks();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
