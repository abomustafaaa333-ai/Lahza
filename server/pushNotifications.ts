import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let firebaseReady = false;

function getFirebaseMessaging() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const raw = encoded
    ? Buffer.from(encoded, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
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
  if (tokens.length === 0) return { sent: 0, failed: 0, failedTokens: [], reason: "no_registered_devices" as const };
  const messaging = getFirebaseMessaging();
  if (!messaging) return { sent: 0, failed: tokens.length, failedTokens: tokens, reason: "firebase_not_configured" as const };
  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: { targetPath: message.targetPath || "/" },
      android: { priority: "high", notification: { channelId: "lahza_notifications", sound: "default" } },
    });
    const failedTokens = response.responses.flatMap((result, index) => result.success ? [] : [tokens[index]]);
    const errorCodes = Array.from(new Set(response.responses.flatMap(result => result.error?.code ? [result.error.code] : [])));
    return { sent: response.successCount, failed: response.failureCount, failedTokens, errorCodes, reason: response.failureCount ? "some_failed" as const : "sent" as const };
  } catch (error) {
    console.error("Firebase push delivery failed", error);
    return { sent: 0, failed: tokens.length, failedTokens: tokens, reason: "firebase_send_error" as const };
  }
}
