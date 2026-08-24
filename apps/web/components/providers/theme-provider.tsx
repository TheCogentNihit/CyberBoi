"use client";

import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("cybershield-theme") as "dark" | "light" | null;
    const initial = stored || "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: (t) => {
      setTheme(t);
      localStorage.setItem("cybershield-theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }}}>
      {children}
    </ThemeContext.Provider>
  );
}

import { createContext, useContext } from "react";

interface ThemeContextType {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
