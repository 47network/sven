self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Sven', body: event.data.text() };
  }

  const title = payload.title || 'Sven';
  const body = payload.body || '';
  const data = payload.data || {};
  const deepLinkToken = data.deep_link_token || data.token || null;
  let actionUrl = data.action_url || '/approvals';
  if (deepLinkToken) {
    const join = actionUrl.includes('?') ? '&' : '?';
    actionUrl = `${actionUrl}${join}token=${encodeURIComponent(String(deepLinkToken))}`;
  }
  const approvalId = data.approval_id || null;

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: payload.tag || data.notification_type || 'sven',
    data: { ...data, action_url: actionUrl },
    renotify: true,
    actions: approvalId
      ? [
          { action: 'approve', title: 'Approve' },
          { action: 'deny', title: 'Deny' },
        ]
      : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const approvalId = data.approval_id;
  const action = event.action;

  event.waitUntil(
    (async () => {
      if ((action === 'approve' || action === 'deny') && approvalId) {
        try {
          await fetch(`/api/v1/approvals/${encodeURIComponent(approvalId)}/vote`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision: action }),
          });
        } catch {
          // Ignore network errors; user can still open approvals page.
        }
      }

      const url = data.action_url || '/approvals';
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            await client.navigate(url);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
