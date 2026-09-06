"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is progressive; failing to register is non-fatal.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
