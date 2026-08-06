import { apiFetch } from "./api";

async function parseResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || fallback);
  }
  return payload.data;
}

export async function editMessageRequest(messageId, content, installId) {
  const response = await apiFetch(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-install-id": installId,
    },
    body: JSON.stringify({ content }),
  });
  return parseResponse(response, "Failed to edit message");
}

export async function deleteMessageRequest(messageId, mode, installId) {
  const response = await apiFetch(`/api/messages/${encodeURIComponent(messageId)}?mode=${encodeURIComponent(mode)}`, {
    method: "DELETE",
    headers: { "x-install-id": installId },
  });
  return parseResponse(response, "Failed to delete message");
}
