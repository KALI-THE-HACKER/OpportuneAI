import { useState, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Share2,
  PlusSquare,
  X,
  Smartphone,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Premium mobile popup for downloading/installing OpportuneAI as a native PWA.
 * Only shown to mobile users opening the site in a mobile browser.
 * Strictly suppressed on the landing page ("/").
 */
export function PwaInstallPrompt() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    isStandalone,
    isMobile,
    canInstall,
    isInstallable,
    isIOS,
    isDismissed,
    install,
    dismiss,
  } = usePwaInstall();

  const [isOpen, setIsOpen] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  // Suppress on landing page
  const isLandingPage = pathname === "/";

  useEffect(() => {
    // Expose a manual trigger on window for testing & debugging: window.__showPwaPrompt()
    if (typeof window !== "undefined") {
      (window as unknown as { __showPwaPrompt?: () => void }).__showPwaPrompt = () => {
        setIsOpen(true);
      };
    }

    if (isLandingPage || isStandalone || isDismissed || !isMobile || !canInstall) {
      setIsOpen(false);
      return;
    }

    // Delay popup by 1.2s so the host page paints smoothly first
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isLandingPage, isStandalone, isDismissed, isMobile, canInstall]);

  if (isLandingPage || isStandalone || !isOpen) {
    return null;
  }

  async function handleActionClick() {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setIsOpen(false);
      }
    } else if (isIOS) {
      setShowIOSSteps(true);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      setShowIOSSteps(true);
    }
  }

  function handleClose() {
    setIsOpen(false);
    dismiss();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Glassmorphic backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Card / Bottom Sheet */}
          <motion.div
            initial={{ opacity: 0, y: "100%", scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "100%", scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-popup-title"
            className="
              relative z-10 w-full sm:max-w-md
              bg-card/95 backdrop-blur-2xl
              border-t sm:border border-border/80
              rounded-t-[32px] sm:rounded-3xl
              shadow-2xl ring-1 ring-border/50
              p-6 sm:p-7 overflow-hidden
            "
            style={{
              paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))",
            }}
          >
            {/* Ambient luxury light glows */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 size-48 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-48 rounded-full bg-brand/10 blur-3xl pointer-events-none" />

            {/* Mobile Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-muted-foreground/25 mx-auto -mt-2 mb-4 sm:hidden" />

            {/* Close Button (X) */}
            <button
              onClick={handleClose}
              aria-label="Close install prompt"
              className="
                absolute top-4 right-4 size-8 rounded-full
                bg-surface/80 hover:bg-surface text-muted-foreground hover:text-foreground
                border border-border/60
                grid place-items-center transition-all duration-150
                shadow-xs cursor-pointer z-20
              "
            >
              <X className="size-4" />
            </button>

            {/* Main Content View vs iOS Guide View */}
            {!showIOSSteps ? (
              <div className="space-y-5">
                {/* Header branding */}
                <div className="flex items-start gap-4 pr-8">
                  <div className="relative size-14 rounded-2xl bg-gradient-to-br from-brand/20 via-surface to-accent/25 p-1 ring-1 ring-border/80 shadow-elevated shrink-0">
                    <img
                      src="/icons/icon-192.png"
                      alt="OpportuneAI Logo"
                      className="size-full rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-accent text-accent-foreground grid place-items-center shadow-xs">
                      <Sparkles className="size-3" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/20 mb-1">
                      <Zap className="size-2.5" />
                      <span>Native App Experience</span>
                    </div>
                    <h2
                      id="pwa-popup-title"
                      className="text-base font-bold text-foreground tracking-tight"
                    >
                      Install OpportuneAI
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fast, full-screen, and offline ready.
                    </p>
                  </div>
                </div>

                {/* Feature Highlights */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 border border-border/50 text-xs">
                    <div className="size-7 rounded-lg bg-card border border-border/60 text-accent grid place-items-center shrink-0">
                      <Zap className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Instant Job Alerts & Speed</p>
                      <p className="text-[11px] text-muted-foreground">
                        Be the first to know when high-match roles go live.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 border border-border/50 text-xs">
                    <div className="size-7 rounded-lg bg-card border border-border/60 text-accent grid place-items-center shrink-0">
                      <Smartphone className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Distraction-Free Workspace</p>
                      <p className="text-[11px] text-muted-foreground">
                        Full-screen app with zero browser URL bar clutter.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 border border-border/50 text-xs">
                    <div className="size-7 rounded-lg bg-card border border-border/60 text-accent grid place-items-center shrink-0">
                      <ShieldCheck className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Offline Access</p>
                      <p className="text-[11px] text-muted-foreground">
                        Read saved listings & tailored outreach anytime.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleActionClick}
                    className="
                      w-full h-11 rounded-xl
                      bg-brand text-brand-foreground
                      font-semibold text-xs sm:text-sm
                      hover:opacity-90 active:scale-[0.99]
                      transition-all duration-150 shadow-md
                      flex items-center justify-center gap-2
                      cursor-pointer
                    "
                  >
                    {isInstallable ? (
                      <>
                        <Download className="size-4" />
                        <span>Install App</span>
                      </>
                    ) : isIOS ? (
                      <>
                        <Smartphone className="size-4 text-accent" />
                        <span>Add to Home Screen (iOS)</span>
                        <ArrowRight className="size-3.5 ml-1" />
                      </>
                    ) : (
                      <>
                        <Download className="size-4" />
                        <span>Download & Install</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleClose}
                    className="
                      w-full py-2 text-center
                      text-xs font-medium text-muted-foreground
                      hover:text-foreground transition-colors
                      cursor-pointer
                    "
                  >
                    Continue in browser
                  </button>
                </div>
              </div>
            ) : (
              /* iOS Step-by-Step Guidance View */
              <div className="space-y-4">
                <div className="flex items-center justify-between pr-8">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-brand text-brand-foreground grid place-items-center">
                      <Smartphone className="size-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Add to iPhone Home Screen
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Takes 5 seconds in Safari</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 my-2">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
                    <div className="size-6 rounded-md bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                      1
                    </div>
                    <div className="text-xs text-foreground flex-1">
                      <p className="font-semibold">Tap the Share button</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1.5">
                        In Safari's bottom toolbar:
                        <Share2 className="size-3.5 text-accent inline shrink-0" />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
                    <div className="size-6 rounded-md bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                      2
                    </div>
                    <div className="text-xs text-foreground flex-1">
                      <p className="font-semibold">Tap "Add to Home Screen"</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1.5">
                        Scroll down the menu list:
                        <PlusSquare className="size-3.5 text-accent inline shrink-0" />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
                    <div className="size-6 rounded-md bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                      3
                    </div>
                    <div className="text-xs text-foreground flex-1">
                      <p className="font-semibold">Tap "Add" at top right</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        The OpportuneAI app icon will appear directly on your home screen.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleClose}
                    className="
                      w-full h-10 rounded-xl
                      bg-brand text-brand-foreground
                      font-semibold text-xs
                      hover:opacity-90 transition-opacity
                      cursor-pointer shadow-sm
                    "
                  >
                    Got it, thanks!
                  </button>

                  <button
                    onClick={() => setShowIOSSteps(false)}
                    className="
                      w-full py-1 text-center
                      text-xs text-muted-foreground hover:text-foreground
                      transition-colors cursor-pointer
                    "
                  >
                    Back to app info
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * An inline button embedded into Settings or Menu drawers for on-demand install
 */
export function InstallAppNavButton({ className = "" }: { className?: string }) {
  const { isStandalone, canInstall, isInstallable, isIOS, install } = usePwaInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isStandalone) {
    return (
      <div
        className={`flex items-center gap-2 px-3 h-8 text-xs text-muted-foreground ${className}`}
      >
        <CheckCircle2 className="size-3.5 text-accent" />
        <span>App installed</span>
      </div>
    );
  }

  if (!canInstall) return null;

  async function handleClick() {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-foreground bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-all cursor-pointer ${className}`}
      >
        <Download className="size-4 text-accent shrink-0" />
        <span className="truncate">Install App</span>
      </button>

      {/* iOS Modal reused if clicked from nav */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm rounded-2xl p-6 bg-card border-border">
          <DialogHeader className="text-center space-y-2">
            <div className="size-12 rounded-2xl bg-brand text-brand-foreground mx-auto grid place-items-center shadow-elevated">
              <Smartphone className="size-6 text-accent" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Install OpportuneAI on iOS
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Follow these simple steps in Safari:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                1
              </div>
              <p className="text-xs text-foreground">
                Tap the <strong>Share</strong> button{" "}
                <Share2 className="size-3 text-accent inline" /> at the bottom of Safari.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                2
              </div>
              <p className="text-xs text-foreground">
                Tap <strong>"Add to Home Screen"</strong>{" "}
                <PlusSquare className="size-3 text-accent inline" />.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                3
              </div>
              <p className="text-xs text-foreground">
                Tap <strong>"Add"</strong> to launch full-screen.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowIOSModal(false)}
            className="w-full h-9 rounded-xl bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
