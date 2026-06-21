"use client";

import * as React from "react";

const STORAGE_KEY = "prisme-blur-amounts";

interface BlurContextValue {
  blurred: boolean;
  toggle: () => void;
  setBlurred: (blurred: boolean) => void;
}

const BlurContext = React.createContext<BlurContextValue | null>(null);

export function BlurProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = React.useState(false);

  React.useEffect(() => {
    // Read the persisted preference only after mount - localStorage isn't
    // available during SSR, and reading it during render would make the
    // server/client markup mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlurred(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  React.useEffect(() => {
    document.documentElement.toggleAttribute("data-blur-amounts", blurred);
    window.localStorage.setItem(STORAGE_KEY, String(blurred));
  }, [blurred]);

  const toggle = React.useCallback(() => setBlurred((current) => !current), []);

  return (
    <BlurContext.Provider value={{ blurred, toggle, setBlurred }}>{children}</BlurContext.Provider>
  );
}

export function useBlur(): BlurContextValue {
  const context = React.useContext(BlurContext);
  if (!context) {
    throw new Error("useBlur must be used within a BlurProvider");
  }
  return context;
}
