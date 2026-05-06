import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastTone = "success" | "info" | "error";

interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const pushToast = useCallback((text: string, tone: ToastTone = "success") => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setToast({ id: Date.now(), text, tone });
    timerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      {toast && (
        <div
          className={`app-toast app-toast--${toast.tone}`}
          key={toast.id}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { pushToast: () => undefined };
  }
  return ctx;
}
