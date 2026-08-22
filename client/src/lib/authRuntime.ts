const AUTH_RUNTIME_STORAGE_KEY = "lahza_auth_runtime_v1";

function createRuntimeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let runtimeId = createRuntimeId();

export function getAuthRuntimeId() {
  return runtimeId;
}

export function lockAuthRuntime() {
  runtimeId = createRuntimeId();
  try {
    sessionStorage.setItem(AUTH_RUNTIME_STORAGE_KEY, runtimeId);
  } catch {
    // The in-memory identifier still protects the running application if storage is unavailable.
  }
}

export function clearAuthRuntimeLock() {
  try {
    sessionStorage.removeItem(AUTH_RUNTIME_STORAGE_KEY);
  } catch {
    // No additional action is needed when browser storage is unavailable.
  }
}
