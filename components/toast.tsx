"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, text: message }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[70] flex flex-col items-center gap-2 pb-[104px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className="animate-ola-fade px-[18px] py-[11px] rounded-full bg-ink text-paper-2 text-sm"
          >
            {m.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
