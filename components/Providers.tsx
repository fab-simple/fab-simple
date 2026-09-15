"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthSync } from "@/components/AuthSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      })
  );

  // Suppress harmless third-party browser extension errors (e.g. MetaMask inpage.js)
  // from crashing or popping up Next.js development error overlays.
  useEffect(() => {
    const handleExtensionError = (event: ErrorEvent) => {
      const isExtension =
        event.filename?.includes("chrome-extension://") ||
        event.error?.stack?.includes("chrome-extension://") ||
        event.message?.toLowerCase().includes("metamask");
      if (isExtension) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const stack = typeof reason === "object" && reason ? String(reason.stack || "") : "";
      const msg = typeof reason === "object" && reason ? String(reason.message || "") : String(reason);
      const isExtension =
        stack.includes("chrome-extension://") ||
        msg.toLowerCase().includes("metamask") ||
        stack.includes("nkbihfbeogaeaoehlefnkodbefgpgknn");
      if (isExtension) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleExtensionError, true);
    window.addEventListener("unhandledrejection", handleRejection, true);
    return () => {
      window.removeEventListener("error", handleExtensionError, true);
      window.removeEventListener("unhandledrejection", handleRejection, true);
    };
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthSync>{children}</AuthSync>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}
