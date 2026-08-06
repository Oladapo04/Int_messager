import { API_BASE } from "./api";

async function postAuth(path, body) {
  const response = await window.fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || `Authentication request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function login({ identifier, password }) {
  return postAuth("/api/auth/login", { identifier, password });
}

export function register({ displayName, email, phone, password, legacyInstallId }) {
  return postAuth("/api/auth/register", { displayName, email, phone, password, legacyInstallId });
}

export function forgotPassword(identifier) {
  return postAuth("/api/auth/forgot-password", { identifier });
}

export function resetPassword(token, newPassword) {
  return postAuth("/api/auth/reset-password", { token, newPassword });
}
