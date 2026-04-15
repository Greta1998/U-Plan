import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const showToast = useCallback((type, title, msg = "") => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, type, title, msg }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="notif-stack" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`notif ${t.type}`}>
            <div className="notif-icon">{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}</div>
            <div>
              <div className="notif-title">{t.title}</div>
              {t.msg ? <div className="notif-msg">{t.msg}</div> : null}
            </div>
            <button type="button" className="notif-close" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
