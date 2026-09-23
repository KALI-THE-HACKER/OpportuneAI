import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "opportune.pwa.popup_dismissed";
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true until verified

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check standalone mode (PWA installed and running)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(isStandaloneMode);

    // Platform detection
    const ua = navigator.userAgent;
    const isAppleMobile =
      /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroidDevice = /Android/i.test(ua);
    setIsIOS(isAppleMobile);
    setIsAndroid(isAndroidDevice);

    const isMobileDevice =
      isAppleMobile ||
      isAndroidDevice ||
      window.innerWidth <= 768 ||
      window.matchMedia("(max-width: 768px)").matches ||
      ("ontouchstart" in window && window.innerWidth <= 1024);
    setIsMobile(isMobileDevice);

    // Check dismissal status
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      setIsDismissed(elapsed < DISMISS_DURATION_MS);
    } else {
      setIsDismissed(false);
    }

    // Capture beforeinstallprompt (Android / Chrome)
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    // Capture appinstalled
    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[pwa] install prompt failed:", err);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // ignore
    }
    setIsDismissed(true);
  }, []);

  const canInstall = !isStandalone && (Boolean(deferredPrompt) || isIOS || isAndroid || isMobile);

  return {
    isStandalone,
    isMobile,
    canInstall,
    isInstallable: Boolean(deferredPrompt),
    isIOS,
    isAndroid,
    isDismissed,
    install,
    dismiss,
  };
}
