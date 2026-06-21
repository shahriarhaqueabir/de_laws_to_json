"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    timersRef.current.add(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm"
        role="alert"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 bg-[#141414] border text-sm font-medium shadow-[0_4px_12px_rgba(0,0,0,0.7)] transition-colors duration-200 animate-slide-in ${
              t.type === "success"
                ? "border-[#888888] text-[#888888]"
                : "border-[#2a2a2a] text-[#a3a3a3]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
