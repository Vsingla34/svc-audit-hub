// Import Firebase background scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// Extract the dynamic configuration passed from the React app
const urlParams = new URLSearchParams(location.search);
const configStr = urlParams.get('config');

if (configStr) {
  const firebaseConfig = JSON.parse(configStr);
  
  // Initialize the background app with dynamic env config
  firebase.initializeApp(firebaseConfig);
  
  // Retrieve background messaging
  const messaging = firebase.messaging();
  
  // Listen for background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || 'StockCheck360 Alert';
    const notificationOptions = {
      body: payload.notification?.body,
      icon: '/vite.svg', // Change this to your actual app logo
    };
  
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
    console.error('[firebase-messaging-sw.js] Firebase configuration not found in URL parameters.');
}