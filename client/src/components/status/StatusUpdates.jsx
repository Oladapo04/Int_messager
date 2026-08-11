import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../services/api";
import "../../styles/status-updates-v4111.css";
import "../../styles/status-quick-composer-v4112.css";
import "../../styles/status-autoplay-v4119.css";

const STATUS_REFRESH_MS = 30000;
const STATUS_VIEW_DURATION_MS = 30000;

function StatusAvatar({ name = "User", src = "", unread = false, large = false }) {
  const initials = String(name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  return (
    <span className={`wa-status-avatar ${unread ? "has-unread" : ""} ${large ? "large" : ""}`}>
      <span className="wa-status-avatar-inner">
        {src ? <img src={src} alt="" /> : <span>{initials}</span>}
      </span>
    </span>
  );
}

function relativeTime(value) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || !timestamp) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { day: "numeric", month: "short" });
}

function expiresIn(value) {
  const remaining = Math.max(0, new Date(value || 0).getTime() - Date.now());
  const hours = Math.ceil(remaining / (60 * 60 * 1000));
  if (hours <= 1) return "Expires within an hour";
  return `Expires in ${hours}h`;
}

export default function StatusUpdates({ currentProfile }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState("text");
  const [statusText, setStatusText] = useState("");
  const [statusFile, setStatusFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const [viewerItems, setViewerItems] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const fileInputRef = useRef(null);

  const loadStatuses = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await apiFetch("/api/statuses");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to load updates");
      }
      setStatuses(Array.isArray(payload?.data) ? payload.data : []);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to load updates");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
    const interval = window.setInterval(() => loadStatuses({ quiet: true }), STATUS_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const myStatuses = useMemo(
    () => statuses.filter((item) => item.isMine),
    [statuses]
  );

  const contactGroups = useMemo(() => {
    const groups = new Map();
    statuses.filter((item) => !item.isMine).forEach((status) => {
      const ownerId = String(status.ownerProfileId || status.owner?._id || "");
      if (!ownerId) return;
      if (!groups.has(ownerId)) groups.set(ownerId, []);
      groups.get(ownerId).push(status);
    });

    return [...groups.values()]
      .map((items) => items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
      .sort((a, b) => new Date(b[b.length - 1]?.createdAt || 0) - new Date(a[a.length - 1]?.createdAt || 0));
  }, [statuses]);

  function resetComposer() {
    setStatusText("");
    setStatusFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openTextComposer() {
    resetComposer();
    setComposerMode("text");
    setError("");
    setNotice("");
    setComposerOpen(true);
  }

  function openPhotoPicker({ reset = true } = {}) {
    if (reset) {
      resetComposer();
      setComposerMode("photo");
      setError("");
      setNotice("");
    } else if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  }

  function closeComposer() {
    resetComposer();
    setComposerMode("text");
    setComposerOpen(false);
  }

  function selectPhoto(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError("Please choose an image file for a photo status.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setComposerMode("photo");
    setStatusFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    setComposerOpen(true);
  }

  async function postStatus() {
    const text = statusText.trim();
    if (!text && !statusFile) {
      setError("Add some text or choose a photo first.");
      return;
    }

    setPosting(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("text", text);
      if (statusFile) form.append("media", statusFile);
      const response = await apiFetch("/api/statuses", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to post status");
      }
      setStatuses((current) => [payload.data, ...current.filter((item) => String(item._id) !== String(payload.data?._id))]);
      setNotice("Status posted. It will disappear automatically after 24 hours.");
      closeComposer();
    } catch (err) {
      setError(err?.message || "Failed to post status");
    } finally {
      setPosting(false);
    }
  }

  function openGroup(items) {
    const ordered = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstUnread = ordered.findIndex((item) => !item.viewedByMe);
    setViewerItems(ordered);
    setViewerIndex(firstUnread >= 0 ? firstUnread : 0);
  }

  function closeViewer() {
    setViewerItems([]);
    setViewerIndex(0);
  }

  const activeViewerStatus = viewerItems[viewerIndex] || null;

  useEffect(() => {
    if (!activeViewerStatus || activeViewerStatus.isMine || activeViewerStatus.viewedByMe) return;
    let cancelled = false;
    apiFetch(`/api/statuses/${encodeURIComponent(activeViewerStatus._id)}/view`, { method: "POST" })
      .then(() => {
        if (cancelled) return;
        setStatuses((current) => current.map((item) => String(item._id) === String(activeViewerStatus._id) ? { ...item, viewedByMe: true } : item));
        setViewerItems((current) => current.map((item) => String(item._id) === String(activeViewerStatus._id) ? { ...item, viewedByMe: true } : item));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeViewerStatus?._id]);

  useEffect(() => {
    if (!activeViewerStatus) return undefined;

    const timer = window.setTimeout(() => {
      setViewerIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < viewerItems.length) return nextIndex;

        window.setTimeout(() => {
          setViewerItems([]);
          setViewerIndex(0);
        }, 0);
        return currentIndex;
      });
    }, STATUS_VIEW_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [activeViewerStatus?._id, viewerItems.length]);

  async function deleteStatus(statusId) {
    if (!statusId) return;
    if (!window.confirm("Delete this status now?")) return;
    try {
      const response = await apiFetch(`/api/statuses/${encodeURIComponent(statusId)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to delete status");
      }
      setStatuses((current) => current.filter((item) => String(item._id) !== String(statusId)));
      setViewerItems((current) => {
        const next = current.filter((item) => String(item._id) !== String(statusId));
        if (!next.length) window.setTimeout(closeViewer, 0);
        return next;
      });
      setViewerIndex((index) => Math.max(0, index - 1));
      setNotice("Status deleted.");
    } catch (err) {
      setError(err?.message || "Failed to delete status");
    }
  }

  return (
    <>
      <div className="wa-status-heading">
        <div>
          <div className="wa-section-label">Updates</div>
          <small>Status updates disappear after 24 hours</small>
        </div>
        <button type="button" className="wa-status-add-btn" onClick={openTextComposer}>✎ New text</button>
      </div>

      <input
        ref={fileInputRef}
        className="wa-status-file-input"
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          if (file) selectPhoto(file);
        }}
      />

      {notice ? <div className="wa-status-notice">{notice}</div> : null}
      {error ? <div className="wa-error">{error}</div> : null}

      <section className="wa-status-my-card">
        <button type="button" className="wa-status-my-main" onClick={() => myStatuses.length ? openGroup(myStatuses) : openTextComposer()}>
          <StatusAvatar name={currentProfile?.displayName || "Me"} src={currentProfile?.avatarUrl || ""} unread={false} />
          <span>
            <strong>My status</strong>
            <small>{myStatuses.length ? `${myStatuses.length} active update${myStatuses.length === 1 ? "" : "s"} · tap to view` : "Share a text or photo update"}</small>
          </span>
        </button>
        <div className="wa-status-quick-actions" aria-label="Create a status update">
          <button type="button" className="wa-status-quick-btn text" onClick={openTextComposer} aria-label="Create text status">
            <span className="wa-status-quick-icon" aria-hidden="true">✎</span>
            <span>Text</span>
          </button>
          <button type="button" className="wa-status-quick-btn photo" onClick={() => openPhotoPicker({ reset: true })} aria-label="Create photo status">
            <span className="wa-status-quick-icon" aria-hidden="true">📷</span>
            <span>Photo</span>
          </button>
        </div>
      </section>

      <div className="wa-status-section-title">Recent updates</div>
      {loading ? <div className="wa-empty dark">Loading updates…</div> : null}
      {!loading && contactGroups.length ? (
        <div className="wa-status-list">
          {contactGroups.map((items) => {
            const latest = items[items.length - 1];
            const owner = latest.owner || {};
            const hasUnread = items.some((item) => !item.viewedByMe);
            return (
              <button key={String(latest.ownerProfileId || owner._id)} type="button" className="wa-status-contact-card" onClick={() => openGroup(items)}>
                <StatusAvatar name={owner.displayName || "Contact"} src={owner.avatarUrl || ""} unread={hasUnread} />
                <span className="wa-status-contact-copy">
                  <strong>{owner.displayName || "Contact"}</strong>
                  <small>{items.length > 1 ? `${items.length} updates · ` : ""}{relativeTime(latest.createdAt)}</small>
                </span>
                <span className={hasUnread ? "wa-status-new-dot" : "wa-status-seen-dot"} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}
      {!loading && !contactGroups.length ? <div className="wa-empty dark">No recent contact updates yet.</div> : null}

      {composerOpen ? (
        <div className="wa-status-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !posting) closeComposer(); }}>
          <section className={`wa-status-composer mode-${composerMode}`} role="dialog" aria-modal="true" aria-label={composerMode === "photo" ? "Create photo status" : "Create text status"}>
            <div className="wa-status-modal-head">
              <div>
                <strong>{composerMode === "photo" ? "Photo status" : "Text status"}</strong>
                <small>Visible to mutual saved contacts · disappears after 24 hours</small>
              </div>
              <button type="button" onClick={closeComposer} disabled={posting} aria-label="Close">×</button>
            </div>

            {composerMode === "photo" && previewUrl ? (
              <div className="wa-status-photo-preview">
                <img src={previewUrl} alt="Selected status" />
                <button type="button" onClick={() => openPhotoPicker({ reset: false })} disabled={posting}>Change photo</button>
              </div>
            ) : null}

            {composerMode === "photo" && !previewUrl ? (
              <button type="button" className="wa-status-photo-empty" onClick={() => openPhotoPicker({ reset: false })} disabled={posting}>
                <span aria-hidden="true">📷</span>
                <strong>Choose a photo</strong>
                <small>Select an image from this device</small>
              </button>
            ) : null}

            <textarea
              className={composerMode === "text" ? "wa-status-text-editor" : "wa-status-caption-editor"}
              value={statusText}
              onChange={(event) => setStatusText(event.target.value.slice(0, 700))}
              placeholder={composerMode === "photo" ? "Add a caption…" : "Type a status update…"}
              rows={composerMode === "photo" ? 3 : 7}
              autoFocus={composerMode === "text"}
            />
            <div className="wa-status-char-count">{statusText.length}/700</div>

            <div className="wa-status-composer-actions quick-mode">
              <button
                type="button"
                className="secondary"
                onClick={composerMode === "photo" ? openTextComposer : () => openPhotoPicker({ reset: true })}
                disabled={posting}
              >
                {composerMode === "photo" ? "✎ Switch to text" : "📷 Switch to photo"}
              </button>
              <button type="button" className="primary" onClick={postStatus} disabled={posting || (!statusText.trim() && !statusFile)}>{posting ? "Posting…" : "Post status"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {activeViewerStatus ? (
        <div className="wa-status-viewer" role="dialog" aria-modal="true" aria-label="Status viewer">
          <div className="wa-status-progress-row" aria-hidden="true">
            {viewerItems.map((item, index) => (
              <span
                key={item._id}
                className={index < viewerIndex ? "complete" : index === viewerIndex ? "current" : ""}
              >
                {index === viewerIndex ? <i key={activeViewerStatus?._id} /> : null}
              </span>
            ))}
          </div>
          <div className="wa-status-viewer-head">
            <StatusAvatar name={activeViewerStatus.owner?.displayName || currentProfile?.displayName || "User"} src={activeViewerStatus.owner?.avatarUrl || currentProfile?.avatarUrl || ""} large />
            <div>
              <strong>{activeViewerStatus.isMine ? "My status" : activeViewerStatus.owner?.displayName || "Status"}</strong>
              <small>{relativeTime(activeViewerStatus.createdAt)} · {expiresIn(activeViewerStatus.expiresAt)}</small>
            </div>
            {activeViewerStatus.isMine ? <button type="button" className="wa-status-delete" onClick={() => deleteStatus(activeViewerStatus._id)}>Delete</button> : null}
            <button type="button" className="wa-status-close" onClick={closeViewer} aria-label="Close">×</button>
          </div>

          <div className={`wa-status-viewer-content ${activeViewerStatus.type === "text" ? "text-only" : "image-status"}`}>
            {activeViewerStatus.type === "image" && activeViewerStatus.mediaUrl ? <img src={activeViewerStatus.mediaUrl} alt="Status" /> : null}
            {activeViewerStatus.text ? <div className="wa-status-viewer-text">{activeViewerStatus.text}</div> : null}
          </div>

          {activeViewerStatus.isMine ? <div className="wa-status-view-count">👁 {Number(activeViewerStatus.viewCount || 0)} view{Number(activeViewerStatus.viewCount || 0) === 1 ? "" : "s"}</div> : null}

          <button type="button" className="wa-status-nav prev" disabled={viewerIndex <= 0} onClick={() => setViewerIndex((index) => Math.max(0, index - 1))} aria-label="Previous status">‹</button>
          <button type="button" className="wa-status-nav next" disabled={viewerIndex >= viewerItems.length - 1} onClick={() => setViewerIndex((index) => Math.min(viewerItems.length - 1, index + 1))} aria-label="Next status">›</button>
        </div>
      ) : null}
    </>
  );
}
