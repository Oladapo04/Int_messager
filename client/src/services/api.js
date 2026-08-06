const API_BASE = "";

export const AUTH_TOKEN_KEY = "int_messager_auth_token_v4";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export async function apiFetch(input, init = {}) {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await window.fetch(input, { ...init, headers });
  return response;
}

export async function apiJson(input, init = {}) {
  const response = await apiFetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export { API_BASE };
