// This file must remain standard JavaScript (not TypeScript)

// 1. Import Firebase libraries for the background worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Initialize Firebase (Replace these with your actual Firebase config keys!)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 3. The Background Listener: This wakes up your phone when the app is closed!
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Received background message ', payload);

  const notificationTitle = payload.notification.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new update.',
    icon: '/favicon.ico', // Shows your app's icon on the notification
    badge: '/favicon.ico', // Shows the small icon on Android status bar
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});