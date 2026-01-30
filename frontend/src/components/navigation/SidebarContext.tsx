"use client";

/**
 * Sidebar Navigation Context
 * Manages sidebar open/closed state across the application
 */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(true); // Keep open on desktop
      }
    };

    // Check initial state
    if (typeof window !== "undefined") {
      setIsOpen(window.innerWidth >= 1024);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
