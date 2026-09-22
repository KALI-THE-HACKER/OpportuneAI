import { useState } from "react";
import { Download, Share2, PlusSquare, X, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function PwaInstallPrompt() {
  const { isStandalone, canInstall, isInstallable, isIOS, isDismissed, install, dismiss } =
    usePwaInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isStandalone || isDismissed || !canInstall) {
    return null;
  }

  async function handleInstallClick() {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        dismiss();
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  }

  return (
    <>
      {/* Floating or Top-docked Install Banner on Mobile/Tablet */}
      <aside
        aria-label="Install App"
        className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-dropdown ring-1 ring-border/50">
          <div className="size-10 rounded-xl bg-brand text-brand-foreground grid place-items-center shrink-0 shadow-sm overflow-hidden">
            <img
              src="/icons/icon-192.png"
              alt="OpportuneAI"
              className="size-10 object-cover"
              onError={(e) => {
                // Fallback to sparkles icon if image load fails
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <Sparkles className="size-5 text-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <span>Install OpportuneAI</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent">
                Fast & Offline
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {isIOS
                ? "Add to your Home Screen for the best experience"
                : "Install for instant access and notifications"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss banner"
              className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Safari Guided Sheet / Dialog */}
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
              Follow these simple steps in Safari to add OpportuneAI to your iPhone or iPad home
              screen:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                1
              </div>
              <div className="text-xs text-foreground flex-1">
                <p className="font-semibold">Tap the Share button</p>
                <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
                  Located at the bottom of Safari's toolbar:
                  <Share2 className="size-3.5 text-accent inline shrink-0" />
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                2
              </div>
              <div className="text-xs text-foreground flex-1">
                <p className="font-semibold">Select "Add to Home Screen"</p>
                <p className="text-muted-foreground text-[11px] mt-0.5 flex items-center gap-1">
                  Scroll down the share sheet and tap:
                  <PlusSquare className="size-3.5 text-accent inline shrink-0" />
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border/60">
              <div className="size-7 rounded-lg bg-card border border-border text-foreground grid place-items-center shrink-0 text-xs font-bold">
                3
              </div>
              <div className="text-xs text-foreground flex-1">
                <p className="font-semibold">Tap "Add" in the top right</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  The app icon will appear directly on your home screen.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setShowIOSModal(false);
              dismiss();
            }}
            className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Got it
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * An inline button that can be embedded into Settings or Menu drawers
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
            className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
