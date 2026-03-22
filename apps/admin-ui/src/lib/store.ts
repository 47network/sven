'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () =>
        set((s) => {
          const next = !s.dark;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next);
          }
          return { dark: next };
        }),
    }),
    {
      name: 'sven-theme',
      onRehydrateStorage: () => (state) => {
        if (state?.dark && typeof document !== 'undefined') {
          document.documentElement.classList.add('dark');
        }
      },
    },
  ),
);

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebar = create<SidebarState>()((set) => ({
  collapsed: false,
  mobileOpen: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
}));

type RuntimeHealth = 'online' | 'degraded' | 'offline';

interface RuntimeState {
  health: RuntimeHealth;
  source: string;
  message: string;
  at: number;
  set: (next: { health: RuntimeHealth; source: string; message: string }) => void;
}

export const useRuntime = create<RuntimeState>()((set) => ({
  health: 'degraded',
  source: 'boot',
  message: 'Initializing admin runtime...',
  at: Date.now(),
  set: (next) =>
    set({
      ...next,
      at: Date.now(),
    }),
}));

export function setRuntimeHealth(next: { health: RuntimeHealth; source: string; message: string }) {
  useRuntime.getState().set(next);
}
