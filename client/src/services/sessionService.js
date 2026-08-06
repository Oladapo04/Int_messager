import { apiJson } from "./api";

export async function listSessions() {
  const payload = await apiJson("/api/auth/sessions");
  return payload.data || [];
}

export async function revokeSession(sessionId) {
  return apiJson(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function revokeOtherSessions() {
  return apiJson("/api/auth/sessions/revoke-others", { method: "POST" });
}
