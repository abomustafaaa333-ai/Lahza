import { Capacitor } from "@capacitor/core";

// Configure VITE_LAHZA_API_ORIGIN for mobile builds so the APK calls the
// current server. The fallback is the Lahza domain, which can be repointed to
// a new host without shipping a new APK.
const configuredApiOrigin = import.meta.env.VITE_LAHZA_API_ORIGIN?.trim().replace(/\/$/, "");

/** The server the app talks to: the Lahza domain inside the Android app, this site on the web. */
export function serverOrigin() {
  return Capacitor.isNativePlatform() ? configuredApiOrigin || "https://lahza-app.duckdns.org" : window.location.origin;
}
