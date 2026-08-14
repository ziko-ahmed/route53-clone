"use client";

/**
 * Notifications.
 *
 * Call notify.success("...") or notify.error("...") from anywhere and a
 * message slides in at the top right, then disappears on its own.
 * AWS calls this component a "flashbar".
 */

import { createContext, useCallback, useContext, useState } from "react";

type Toast = {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
};

type ToastState = {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastState | null>(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, kind, text }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value: ToastState = {
    success: (text) => push("success", text),
    error: (text) => push("error", text),
    info: (text) => push("info", text),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="flashbar" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flash flash-${toast.kind}`}>
            <span aria-hidden="true">
              {toast.kind === "success" ? "✓" : toast.kind === "error" ? "⚠" : "ℹ"}
            </span>
            <span className="flash-text">{toast.text}</span>
            <button
              className="flash-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
