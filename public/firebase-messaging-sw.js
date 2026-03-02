

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');


const firebaseConfig = {
  apiKey: "AIzaSyB_Bv6PVbPuThrXImzh5vtKfX6NKsiZqqw",
  authDomain: "audit-flow-stockcheck360.firebaseapp.com",
  projectId: "audit-flow-stockcheck360",
  storageBucket: "audit-flow-stockcheck360.firebasestorage.app",
  messagingSenderId: "17452550996",
  appId: "1:17452550996:web:433fab03a3c780604c96c1",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();


messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || 'New Notification';
  const body = payload.notification?.body || payload.data?.body || '';
  const assignmentId = payload.data?.assignment_id;
  const url = assignmentId ? `/assignment/${assignmentId}` : '/';

  const notificationOptions = {
    body,
    icon: '/favicon.ico',         // Update to your app icon path
    badge: '/favicon.ico',        // Small monochrome icon shown in Android status bar
    tag: assignmentId || 'general', // Prevents duplicate notifications for same assignment
    renotify: true,               // Vibrate/sound even if same tag exists
    requireInteraction: false,    // Auto-dismiss after a while
    data: { url, assignmentId },
    actions: [
      { action: 'view', title: 'View Assignment' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, assignmentId } = event.data.payload;

    const notificationOptions = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: assignmentId || 'foreground-notif',
      renotify: true,
      requireInteraction: false,
      data: { url: url || '/', assignmentId },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    // Must wait for the showNotification promise so SW stays alive
    event.waitUntil(
      self.registration.showNotification(title || 'New Notification', notificationOptions)
    );
  }
});

// ─── 3. Handle notification CLICK ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── 4. Activate immediately (don't wait for page reload) ────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});