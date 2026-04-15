import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set, get) => ({
      dark: true,   // canvas-ui is a dark-first experience
      toggle: () => {
        const next = !get().dark;
        set({ dark: next });
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', next);
        }
      },
    }),
    {
      name: 'canvas-theme',
      onRehydrateStorage: () => (state) => {
        if (typeof document !== 'undefined') {
          // Apply stored preference; default on first load is dark=true
          document.documentElement.classList.toggle('dark', state?.dark !== false);
        }
      },
    },
  ),
);

interface SidebarStore {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebar = create<SidebarStore>()((set, get) => ({
  collapsed: false,
  toggle: () => set({ collapsed: !get().collapsed }),
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
  message: 'Initializing canvas runtime...',
  at: Date.now(),
  set: (next) => set({ ...next, at: Date.now() }),
}));

export function setRuntimeHealth(next: { health: RuntimeHealth; source: string; message: string }) {
  useRuntime.getState().set(next);
}

interface CouncilModeStore {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useCouncilMode = create<CouncilModeStore>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled: boolean) => set({ enabled }),
    }),
    { name: 'canvas-council-mode' },
  ),
);
