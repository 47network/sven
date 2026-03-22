'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const PUSH_TOKEN_KEY = 'sven_canvas_push_token';

function base64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=').replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export default function PwaControls({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const vapidPublicKey = useMemo(() => process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || '', []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let mounted = true;
    (async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (mounted) setSubscribed(!!sub);
      } catch {
        // No-op: app can still function without service worker.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      toast.info('Install is available from your browser menu.');
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      toast.success('Sven Canvas installed.');
      setInstallEvent(null);
    }
  }

  async function enablePush() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications are not supported on this browser.');
      return;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') {
      toast.error('Notification permission was not granted.');
      return;
    }

    if (!vapidPublicKey) {
      toast.error('Push key missing. Set NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY.');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const token = JSON.stringify(sub.toJSON());
    await api.push.register(token, 'web', navigator.userAgent);
    window.localStorage.setItem(PUSH_TOKEN_KEY, token);
    setSubscribed(true);
    toast.success('Push notifications enabled.');
  }

  async function disablePush() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const token = sub ? JSON.stringify(sub.toJSON()) : window.localStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await api.push.unregister(token);
      window.localStorage.removeItem(PUSH_TOKEN_KEY);
    }
    if (sub) await sub.unsubscribe();
    setSubscribed(false);
    toast.success('Push notifications disabled.');
  }

  return (
    <div className={compact ? 'space-y-2' : 'mt-4 flex gap-2'}>
      <button
        onClick={() => void installApp()}
        className="btn btn-sm btn-secondary w-full justify-center"
        title="Install PWA"
      >
        <Download className="h-3.5 w-3.5" />
        {!compact && <span>Install</span>}
      </button>

      {subscribed ? (
        <button
          onClick={() => void disablePush()}
          className="btn btn-sm w-full justify-center border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
          title="Disable notifications"
        >
          <BellOff className="h-3.5 w-3.5" />
          {!compact && <span>Mute</span>}
        </button>
      ) : (
        <button
          onClick={() => void enablePush()}
          className="btn btn-sm btn-primary w-full justify-center"
          title="Enable notifications"
          disabled={permission === 'denied'}
        >
          <Bell className="h-3.5 w-3.5" />
          {!compact && <span>Notify</span>}
        </button>
      )}
    </div>
  );
}
