'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/store';

interface ThemeToggleProps {
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ThemeToggle({ size = 'md', showLabel = false }: ThemeToggleProps) {
  const { dark, toggle } = useTheme();

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <Sun className={iconSize} />
      ) : (
        <Moon className={iconSize} />
      )}
      {showLabel && (
        <span className="text-sm">{dark ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  );
}
