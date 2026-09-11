import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let firebaseReady = false;

function getFirebaseMessaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
    const app = getApps().length ? getApp() : initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
      }),
    });
    firebaseReady = true;
    return getMessaging(app);
  } catch (error) {
    console.error("Firebase push notifications are not configured correctly", error);
    return null;
  }
}

export function isFirebasePushReady() {
  getFirebaseMessaging();
  return firebaseReady;
}

export async function sendPushNotification(tokens: string[], message: { title: string; body: string; targetPath?: string }) {
  const messaging = getFirebaseMessaging();
  if (!messaging || tokens.length === 0) return { sent: 0, failed: 0 };
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: message.title, body: message.body },
    data: { targetPath: message.targetPath || "/" },
    android: { priority: "high", notification: { channelId: "lahza_notifications", sound: "default" } },
  });
  return { sent: response.successCount, failed: response.failureCount };
}
