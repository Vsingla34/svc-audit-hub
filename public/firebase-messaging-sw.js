importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB_Bv6PVbPuThrXImzh5vtKfX6NKsiZqqw",
  authDomain: "audit-flow-stockcheck360.firebaseapp.com",
  projectId: "audit-flow-stockcheck360",
  storageBucket: "audit-flow-stockcheck360.firebasestorage.app",
  messagingSenderId: "17452550996",
  appId: "1:17452550996:web:433fab03a3c780604c96c1"
});

const messaging = firebase.messaging();

// ✅ BACKGROUND: Fires when app is closed or browser tab is not active
// The browser OS handles showing the notification automatically when a
// `notification` block is present in the FCM payload (which our server sends).
// This handler is a fallback for any extra customization needed.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  // Only manually show if there's no notification block (data-only message)
  if (payload.notification) return;

  return self.registration.showNotification(
    payload.data?.title || 'StockCheck360',
    {
      body: payload.data?.body || 'You have a new notification.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      data: {
        url: payload.data?.assignment_id
          ? `/assignments/${payload.data.assignment_id}`
          : '/'
      }
    }
  );
});

// ✅ FOREGROUND: The React app posts a message here when onMessage fires,
// so the SW can show the native OS banner (calling showNotification from the
// page context is unreliable on Android Chrome — must be called from SW).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, assignmentId } = event.data.payload;

    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: assignmentId || 'default',   // collapses duplicate notifications
      renotify: true,                   // still vibrates even if same tag
      data: { url: url || '/' }
    });
  }
});

// ✅ Handles what happens when user TAPS the notification banner
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app tab is already open, focus and navigate it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      // App not open — open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});