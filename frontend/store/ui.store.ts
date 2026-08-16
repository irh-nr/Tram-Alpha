import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  activeTimeframe: string;
  theme: "dark" | "light";

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTimeframe: (tf: string) => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTimeframe: "1h",
  theme: "dark",

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  setTheme: (theme) => set({ theme }),
}));
