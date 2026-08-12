"use client";

import { useEffect } from "react";

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

const INTERACTIVE_SELECTOR = "button, a, [role='button'], input, select, textarea, summary";
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";

function getCapacitorBridge(): CapacitorBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { Capacitor?: CapacitorBridge }).Capacitor;
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isNativeShell() {
  const capacitor = getCapacitorBridge();
  if (capacitor?.isNativePlatform?.()) return true;

  const platform = capacitor?.getPlatform?.();
  return Boolean(platform && platform !== "web") || isStandaloneDisplayMode();
}

export default function NativeRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const capacitor = getCapacitorBridge();
    const platform = capacitor?.getPlatform?.() ?? (isStandaloneDisplayMode() ? "standalone" : "web");
    const nativeShell = isNativeShell();

    root.dataset.platform = platform;
    root.dataset.shell = nativeShell ? "native" : "web";
    root.dataset.network = navigator.onLine ? "online" : "offline";

    const setViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-height", `${height}px`);
    };

    const setNetworkState = () => {
      root.dataset.network = navigator.onLine ? "online" : "offline";
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!nativeShell) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(EDITABLE_SELECTOR)) return;

      event.preventDefault();
    };

    const handleInteractivePointer = (event: PointerEvent) => {
      if (!nativeShell || event.pointerType === "mouse") return;

      const target = event.target as HTMLElement | null;
      if (!target?.closest(INTERACTIVE_SELECTOR)) return;

      navigator.vibrate?.(8);
    };

    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);
    window.visualViewport?.addEventListener("resize", setViewportHeight);
    window.addEventListener("online", setNetworkState);
    window.addEventListener("offline", setNetworkState);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("pointerup", handleInteractivePointer, true);

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.visualViewport?.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("online", setNetworkState);
      window.removeEventListener("offline", setNetworkState);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerup", handleInteractivePointer, true);
    };
  }, []);

  return null;
}


