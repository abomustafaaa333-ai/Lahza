const CUSTOMER_SESSION_STORAGE_KEY = "lahza_customer_session_v1";

/**
 * The customer's signed session, kept by the app itself. The Android WebView
 * does not reliably keep the server's cross-site cookie after the app closes,
 * which made every launch ask for a new WhatsApp code.
 */
export function getCustomerSessionToken() {
  try {
    return localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY) ?? sessionStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveCustomerSessionToken(token: string | undefined, remember = true) {
  if (!token) return;
  try {
    (remember ? localStorage : sessionStorage).setItem(CUSTOMER_SESSION_STORAGE_KEY, token);
  } catch {
    // Without storage the cookie still carries the session while the app stays open.
  }
}

export function clearCustomerSessionToken() {
  try {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}
