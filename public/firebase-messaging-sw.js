importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 1. Initialize Firebase FIRST
firebase.initializeApp({
  apiKey: "AIzaSyB_Bv6PVbPuThrXImzh5vtKfX6NKsiZqqw",
  authDomain: "audit-flow-stockcheck360.firebaseapp.com",
  projectId: "audit-flow-stockcheck360",
  storageBucket: "audit-flow-stockcheck360.firebasestorage.app",
  messagingSenderId: "17452550996",
  appId: "1:17452550996:web:433fab03a3c780604c96c1"
});

// 2. Define the messaging variable SECOND
const messaging = firebase.messaging();

// 3. Use the variable THIRD
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received: ', payload);
  
  const title = payload.data?.title || 'StockCheck360 Update';
  const options = {
    body: payload.data?.body || 'You have a new notification.',
    icon: '/favicon.ico', 
    requireInteraction: true 
  };

  return self.registration.showNotification(title, options);
});