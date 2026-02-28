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

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  // Don't show a duplicate if the browser already handled the notification block
  // This only fires for data-only messages
  if (payload.notification) return;

  const title = payload.data?.title || 'StockCheck360';
  const options = {
    body: payload.data?.body || 'You have a new notification.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: {
      url: payload.data?.assignment_id
        ? `/assignments/${payload.data.assignment_id}`
        : '/',
      assignment_id: payload.data?.assignment_id || ''
    }
  };

  return self.registration.showNotification(title, options);
});

// ✅ Handles what happens when user TAPS the notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    // Check if app is already open in a tab
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If app is already open, focus it and navigate
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      // App is not open — open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});