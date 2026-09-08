# PUSH NOTIFICATION IMPLEMENTATION GUIDE

This document shows how to integrate native push notifications into Nicole's Nixon dashboard so the four daily pulses, Portuguese lessons, and critical alerts actually wake up her phone.

---

## WHAT YOU'RE BUILDING

Instead of:
- 08:00 Telegram message sits in the chat
- Nicole has to open the app or check Telegram
- Easy to miss if she's in a meeting or focused on lab work

You're building:
- 08:00 **Push notification pops up on her phone screen**
- Title: "Good morning, Nicole"
- Preview: "3 priorities today"
- Sound + vibration (configurable)
- Tap it → jumps to Home screen
- Works even if app is closed

---

## THE TECH STACK FOR PUSH NOTIFICATIONS

### Option 1: Firebase Cloud Messaging (FCM) — Recommended for cross-platform

**Pros:**
- Works on Android, iOS, web, all at once
- Free (Google Cloud)
- Robust, battle-tested
- Easy to test

**Cons:**
- Requires Google Cloud project setup
- iOS requires Apple Developer account + APNs certificate

**Setup:** ~30 minutes

### Option 2: Native Platform Services (more complex, more reliable)

- **Android:** Firebase Cloud Messaging (same as Option 1)
- **iOS:** Apple Push Notification service (APNs) — requires certificate
- **Web:** Web Push API (built into browsers)

**Pros:**
- Maximum control, maximum reliability on each platform

**Cons:**
- More setup, three different systems to manage

**Setup:** ~2 hours

**Recommendation for Nicole:** Start with Firebase (Option 1). If she runs into iOS issues later, migrate to native APNs.

---

## FIREBASE CLOUD MESSAGING SETUP (OPTION 1)

### 1. Create a Firebase Project

1. Go to [firebase.google.com](https://firebase.google.com)
2. Click "Get Started"
3. Create a new project:
   - Project name: "Nixon"
   - Enable Google Analytics (optional, but useful for understanding usage)
4. Wait for provisioning (~5 min)

### 2. Get Your Credentials

1. In the Firebase console, go to **Project Settings** (gear icon, top-left)
2. Click **Service Accounts**
3. Click **Generate New Private Key**
4. Save the JSON file to your repo (add to .gitignore!)
5. Copy the contents into your `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

### 3. Set Up Web Push (for desktop notifications)

1. In Firebase Console, go to **Cloud Messaging**
2. Scroll to "Web configuration"
3. Copy your **Web API Key** into `.env`:

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_MESSAGING_SENDER_ID=1234567890
FIREBASE_APP_ID=1:1234567890:web:abcdef...
```

4. Create `public/firebase-messaging-sw.js`:

```javascript
// Service worker for Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// Handle notification when app is in background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/app-icon-192x192.png',
    badge: '/app-badge-72x72.png',
    tag: payload.data.deepLink || 'notification',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus().then(() => {
            // Send message to client to navigate
            client.postMessage({ type: 'navigate', deepLink: event.notification.data.deepLink });
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.deepLink || '/');
      }
    })
  );
});
```

---

## BACKEND IMPLEMENTATION (Node.js + Express)

### 1. Initialize Firebase Admin SDK

```bash
npm install firebase-admin
```

### 2. Create the Push Notification Service

`src/services/push-notification.service.js`:

```javascript
const admin = require('firebase-admin');
const db = require('../db'); // your Postgres connection

class PushNotificationService {
  constructor() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    this.messaging = admin.messaging();
  }

  async sendNotification(userId, {
    title,
    body,
    deepLink = '/',
    sound = 'default',
    badge = '1',
    priority = 'normal', // 'high' ignores quiet hours, 'normal' respects them
  }) {
    try {
      // 1. Get user's notification settings and FCM token
      const settings = await db.query(
        'SELECT * FROM user_notification_settings WHERE user_id = $1',
        [userId]
      );

      if (!settings.rows.length || !settings.rows[0].fcm_token) {
        console.log(`No FCM token for user ${userId}. Notification queued for fallback.`);
        return { success: false, queued: true };
      }

      const userSettings = settings.rows[0];

      // 2. Check if push notifications are enabled
      if (!userSettings.enable_push) {
        console.log(`Push notifications disabled for user ${userId}`);
        return { success: false, disabled: true };
      }

      // 3. Check quiet hours (if priority is not 'high')
      if (priority !== 'high') {
        const now = new Date();
        const quietStart = new Date();
        const quietEnd = new Date();
        
        const [startHour, startMin] = userSettings.quiet_hours_start.split(':');
        const [endHour, endMin] = userSettings.quiet_hours_end.split(':');
        
        quietStart.setHours(parseInt(startHour), parseInt(startMin), 0);
        quietEnd.setHours(parseInt(endHour), parseInt(endMin), 0);

        if (this.isWithinQuietHours(now, quietStart, quietEnd)) {
          console.log(`User ${userId} in quiet hours. Queueing notification.`);
          await this.queueNotification(userId, { title, body, deepLink, sound, badge, priority });
          return { success: false, queued: true };
        }
      }

      // 4. Compose FCM message
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          deepLink,
          badge,
        },
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: sound !== 'silence' ? 'default' : undefined,
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: sound !== 'silence' ? 'default' : undefined,
              badge: parseInt(badge),
            },
          },
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/app-icon-192x192.png',
            badge: '/app-badge-72x72.png',
            tag: deepLink,
          },
          fcmOptions: {
            link: deepLink,
          },
        },
      };

      // 5. Send via Firebase Cloud Messaging
      const response = await this.messaging.send({
        token: userSettings.fcm_token,
        ...message,
      });

      // 6. Log successful send
      await db.query(
        'INSERT INTO notification_log (user_id, title, body, deep_link, sent_at) VALUES ($1, $2, $3, $4, NOW())',
        [userId, title, body, deepLink]
      );

      console.log(`Notification sent to user ${userId}:`, response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
      
      // Fallback: send via Telegram instead
      await this.sendTelegramFallback(userId, title, body);
      return { success: false, error: error.message, fallback: 'telegram' };
    }
  }

  async sendTelegramFallback(userId, title, body) {
    // Send to Telegram as fallback
    const chatId = await db.query('SELECT telegram_chat_id FROM users WHERE id = $1', [userId]);
    if (chatId.rows.length && chatId.rows[0].telegram_chat_id) {
      // Use your Telegram bot to send the message
      // (implement based on your bot setup)
      console.log(`Telegram fallback: ${title} - ${body}`);
    }
  }

  async queueNotification(userId, { title, body, deepLink, sound, badge, priority }) {
    // Calculate when to send (after quiet hours)
    const userSettings = await db.query(
      'SELECT quiet_hours_end FROM user_notification_settings WHERE user_id = $1',
      [userId]
    );

    const endTime = userSettings.rows[0]?.quiet_hours_end || '08:00';
    const [endHour, endMin] = endTime.split(':');
    const scheduledFor = new Date();
    scheduledFor.setHours(parseInt(endHour), parseInt(endMin), 0);

    await db.query(
      'INSERT INTO notification_queue (user_id, title, body, deep_link, scheduled_for, priority) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, title, body, deepLink, scheduledFor, priority]
    );
  }

  isWithinQuietHours(now, quietStart, quietEnd) {
    if (quietStart < quietEnd) {
      // Quiet hours don't cross midnight (e.g., 08:00 - 22:00)
      return now >= quietStart && now < quietEnd;
    } else {
      // Quiet hours cross midnight (e.g., 22:00 - 08:00)
      return now >= quietStart || now < quietEnd;
    }
  }

  async processQueuedNotifications() {
    // Run this every minute to send queued notifications that are now due
    const now = new Date();
    const queued = await db.query(
      'SELECT * FROM notification_queue WHERE scheduled_for <= $1 AND sent_at IS NULL ORDER BY scheduled_for ASC',
      [now]
    );

    for (const notification of queued.rows) {
      await this.sendNotification(notification.user_id, {
        title: notification.title,
        body: notification.body,
        deepLink: notification.deep_link,
        priority: notification.priority,
      });

      await db.query(
        'UPDATE notification_queue SET sent_at = NOW() WHERE id = $1',
        [notification.id]
      );
    }
  }
}

module.exports = new PushNotificationService();
```

### 3. Wire Up the Four Daily Pulses

`src/jobs/daily-pulses.js`:

```javascript
const cron = require('node-cron');
const pushService = require('../services/push-notification.service');
const db = require('../db');

// Morning Brief (08:00 Europe/Lisbon)
cron.schedule('0 8 * * *', { timezone: 'Europe/Lisbon' }, async () => {
  console.log('Sending Morning Brief...');
  
  const users = await db.query('SELECT id FROM users WHERE active = true');
  
  for (const user of users.rows) {
    // Get today's priorities
    const tasks = await db.query(
      'SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND state = $2 AND DATE(due_at) = CURRENT_DATE',
      [user.id, 'pending']
    );

    await pushService.sendNotification(user.id, {
      title: '🌅 Good morning, Nicole',
      body: `${tasks.rows[0].count} priorities today`,
      deepLink: '/home',
      priority: 'high', // Override quiet hours
    });
  }
});

// Mid-Day Pivot (12:00 Europe/Lisbon)
cron.schedule('0 12 * * *', { timezone: 'Europe/Lisbon' }, async () => {
  console.log('Sending Mid-Day Pivot...');
  
  const users = await db.query('SELECT id FROM users WHERE active = true');
  
  for (const user of users.rows) {
    const completed = await db.query(
      'SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND state = $2 AND DATE(completed_at) = CURRENT_DATE',
      [user.id, 'completed']
    );

    await pushService.sendNotification(user.id, {
      title: '⏰ Mid-Day Pivot',
      body: `${completed.rows[0].count} tasks done. What's next?`,
      deepLink: '/home',
    });
  }
});

// Evening Wind-down (18:00 Europe/Lisbon)
cron.schedule('0 18 * * *', { timezone: 'Europe/Lisbon' }, async () => {
  console.log('Sending Evening Wind-down...');
  
  const users = await db.query('SELECT id FROM users WHERE active = true');
  
  for (const user of users.rows) {
    await pushService.sendNotification(user.id, {
      title: '🌆 Evening Wind-down',
      body: 'What to pause? What to carry to tomorrow?',
      deepLink: '/home',
    });
  }
});

// Final Sync (22:00 Europe/Lisbon)
cron.schedule('0 22 * * *', { timezone: 'Europe/Lisbon' }, async () => {
  console.log('Sending Final Sync...');
  
  const users = await db.query('SELECT id FROM users WHERE active = true');
  
  for (const user of users.rows) {
    await pushService.sendNotification(user.id, {
      title: '🌙 Final Sync',
      body: 'Clear the board. Tomorrow is plotted.',
      deepLink: '/home',
      priority: 'normal', // May queue if within quiet hours
    });
  }
});

// Process queued notifications every minute
cron.schedule('* * * * *', async () => {
  await pushService.processQueuedNotifications();
});
```

### 4. Register FCM Token on App Load

`src/routes/api/push-subscribe.js`:

```javascript
const express = require('express');
const router = express.Router();
const db = require('../../db');

// POST /api/push-subscribe
router.post('/push-subscribe', async (req, res) => {
  try {
    const { userId } = req.user; // from session
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    // Update or insert FCM token
    await db.query(
      `INSERT INTO user_notification_settings (user_id, fcm_token) 
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET fcm_token = $2`,
      [userId, fcmToken]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## FRONTEND IMPLEMENTATION (React)

### 1. Request Notification Permission and Subscribe to Push

`src/hooks/usePushNotification.js`:

```javascript
import { useEffect } from 'react';

export function usePushNotification() {
  useEffect(() => {
    if ('serviceWorkerContainer' not in navigator) {
      console.log('Service Workers not supported');
      return;
    }

    // Register service worker
    navigator.serviceWorkerContainer.register('/firebase-messaging-sw.js').then((registration) => {
      console.log('Service Worker registered');

      // Check if already subscribed
      registration.pushManager.getSubscription().then((subscription) => {
        if (!subscription) {
          // First time - ask for permission
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              console.log('Notification permission granted');
              
              // Subscribe to push notifications
              registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_KEY),
              }).then((sub) => {
                // Send subscription to backend
                fetch('/api/push-subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fcmToken: JSON.stringify(sub) }),
                });
              });
            }
          });
        } else {
          console.log('Already subscribed to push notifications');
        }
      });
    }).catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  }, []);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}
```

### 2. Use It in Your App

`src/App.jsx`:

```javascript
import { usePushNotification } from './hooks/usePushNotification';

export default function App() {
  usePushNotification(); // Call once on app load

  return (
    // ... rest of app
  );
}
```

### 3. Handle Notification Clicks in Frontend

`src/components/NotificationHandler.jsx`:

```javascript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function NotificationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for messages from service worker
    if ('serviceWorkerContainer' in navigator) {
      navigator.serviceWorkerContainer.addEventListener('message', (event) => {
        if (event.data.type === 'navigate') {
          navigate(event.data.deepLink || '/');
        }
      });
    }
  }, [navigate]);

  return null;
}
```

Use it:

```javascript
<App>
  <NotificationHandler />
  {/* rest of app */}
</App>
```

---

## TESTING PUSH NOTIFICATIONS

### 1. Test Without Actually Waiting for Scheduled Time

```bash
# Send a test notification immediately
curl -X POST http://localhost:3000/api/test-notification \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Alert", "body": "This is a test"}'
```

### 2. Test Quiet Hours

Set your quiet hours to 5 minutes in the future, then trigger a notification. It should queue instead of send immediately.

### 3. Test Notification Click

Send a notification with `deepLink: '/tasks'`. Click the notification on your phone — it should jump to the Tasks screen.

---

## PRODUCTION CHECKLIST

- [ ] Firebase project created and configured
- [ ] Service worker registered and working
- [ ] FCM tokens stored in database
- [ ] Four daily pulse cron jobs running
- [ ] Notification queue processing every minute
- [ ] Quiet hours enforced
- [ ] Telegram fallback working if FCM fails
- [ ] Notification log queryable (for history)
- [ ] Test notification sent and received on real device
- [ ] Settings UI lets Nicole control sound, vibration, quiet hours

---

That's it. With this, Nicole's phone wakes up at 08:00, 12:00, 18:00, 22:00 with real notifications, not just Telegram messages. Same for Portuguese lessons at 07:00, quizzes at 20:00, and competition deadlines. 🔔
