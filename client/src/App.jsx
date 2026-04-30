import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildRtcConfig, safeSetRemoteDescription, safeRestartIce, replaceOutgoingVideoTrack } from "./call/webrtcUtils";
import io from "socket.io-client";

const API_BASE = "";
const socket = io(API_BASE, { autoConnect: true });

const INSTALL_ID_KEY = "int_messager_install_id";
const PLAYED_KEY = "wa_voice_played_map";
const REACTION_OPTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "💯", "😆", "😎", "🤔", "😡", "💔", "✅", "👀", "🙌"];
const CHAT_EMOJIS = ["😀", "😁", "😂", "🤣", "😍", "😘", "😊", "😎", "😭", "😢", "😮", "😡", "🤔", "🙏", "❤️", "💔", "👍", "👎", "👏", "🙌", "🔥", "🎉", "💯", "✅", "👀", "✨", "🚀", "🎤", "📎", "📞"];
const CHAT_PREFS_KEY = "int_messager_chat_prefs_v1";
const PWA_BEFORE_INSTALL_PROMPT = "beforeinstallprompt";

function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function registerPwaServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.warn("Service worker registration failed:", error));
  });
}


function readJsonStorage(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
}
function writeJsonStorage(key, value) { localStorage.setItem(key, JSON.stringify(value || {})); }
function loadChatPrefs() {
  return {
    appColor: "#0f172a",
    accentColor: "#22c55e",
    wallpaper: "#dbe4ea",
    chatColor: "#dcfce7",
    bubbleShape: "rounded",
    fontSize: "normal",
    ...readJsonStorage(CHAT_PREFS_KEY, {}),
  };
}
function saveChatPrefs(prefs) { writeJsonStorage(CHAT_PREFS_KEY, prefs); }

function formatCallDuration(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const sec = safe % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}



function getOrCreateInstallId() {
  let current = localStorage.getItem(INSTALL_ID_KEY);
  if (!current) {
    current =
      window.crypto?.randomUUID?.() ||
      `install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(INSTALL_ID_KEY, current);
  }
  return current;
}

function formatTime(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded =
    value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function formatPlayerTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function slugifyRoomName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveMediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
}

function getAttachmentName(item) {
  return item?.fileName || item?.content || "Attachment";
}

function guessMimeType(item) {
  const explicit = item?.mimeType || item?.fileType || item?.fileMimeType || "";
  if (explicit) return explicit;

  const name = getAttachmentName(item).toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|heic|heif)$/.test(name)) return "image/*";
  if (/\.pdf$/.test(name)) return "application/pdf";
  if (/\.(doc|docx)$/.test(name)) return "application/msword";
  if (/\.(xls|xlsx|csv)$/.test(name)) return "application/vnd.ms-excel";
  if (/\.(zip|rar|7z)$/.test(name)) return "application/zip";
  if (/\.(mp4|mov|avi|webm)$/.test(name)) return "video/*";
  if (/\.(mp3|wav|ogg|m4a|webm)$/.test(name)) return "audio/*";
  return "application/octet-stream";
}

function isImageAttachment(item) {
  return guessMimeType(item).startsWith("image/");
}

function isPdfAttachment(item) {
  return guessMimeType(item).includes("pdf");
}

function getFileKindLabel(item) {
  if (isPdfAttachment(item)) return "PDF";
  if (isImageAttachment(item)) return "IMG";
  const name = getAttachmentName(item);
  const ext = name.includes(".") ? name.split(".").pop() : "FILE";
  return String(ext || "FILE").toUpperCase().slice(0, 8);
}

function loadPlayedMap() {
  try {
    return JSON.parse(localStorage.getItem(PLAYED_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePlayedMap(map) {
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function normalizeReactions(reactions) {
  if (!reactions) return {};
  if (reactions instanceof Map) return Object.fromEntries(reactions.entries());
  return reactions;
}

function groupMessagesByDay(messages) {
  const groups = [];
  let lastDay = "";

  messages.forEach((message) => {
    const dayLabel = new Date(message.createdAt).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (dayLabel !== lastDay) {
      groups.push({ type: "day", label: dayLabel });
      lastDay = dayLabel;
    }

    groups.push({ type: "message", message });
  });

  return groups;
}

function getRoomDisplayName(room, currentUserName, currentProfileId = "", profiles = []) {
  if (!room) return "Chat";
  if (!room.isDirect) return room.name || room.slug || "General";

  const participantIds = Array.isArray(room.participants)
    ? room.participants.map((id) => String(id))
    : [];

  const otherProfileId = participantIds.find(
    (id) => id && String(id) !== String(currentProfileId || "")
  );

  if (otherProfileId && Array.isArray(profiles)) {
    const otherProfile = profiles.find((user) => String(user._id) === String(otherProfileId));
    if (otherProfile?.displayName) return otherProfile.displayName;
  }

  const raw = room.name || "";
  const parts = raw.split("&").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 2) {
    const current = String(currentUserName || "").trim().toLowerCase();
    const other = parts.find((name) => name.trim().toLowerCase() !== current);
    return other || parts[0];
  }

  return raw || "Direct chat";
}

function generateWaveBars(count = 38) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const value =
      0.35 +
      0.45 * Math.abs(Math.sin(t * Math.PI * 2.6)) +
      0.2 * Math.abs(Math.cos(t * Math.PI * 5.1));

    return Math.max(6, Math.round(value * 22));
  });
}

function getInitial(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() : "?";
}

function Avatar({ label, src = "", className = "" }) {
  return (
    <div className={`wa-avatar ${className}`}>
      {src ? <img src={resolveMediaUrl(src)} alt={label || "Profile"} /> : getInitial(label)}
    </div>
  );
}

function DownloadButton({ href, fileName, className = "wa-attachment-action" }) {
  return (
    <a className={className} href={href} download={fileName || true} target="_blank" rel="noreferrer">
      Download
    </a>
  );
}

function AttachmentPreview({ item, pending = false }) {
  const href = pending ? item.previewUrl : resolveMediaUrl(item.fileUrl);
  const name = getAttachmentName(item);
  const isImage = isImageAttachment(item);
  const isPdf = isPdfAttachment(item);
  const sizeLabel = formatFileSize(item.fileSize || item.size);
  const progress = Math.max(0, Math.min(item.progress || 0, 100));

  const progressLabel =
    item.status === "uploading"
      ? progress >= 100
        ? "Processing…"
        : `Uploading ${progress}%`
      : item.status === "processing"
        ? "Processing…"
        : item.status === "queued"
          ? "Queued"
          : item.status === "failed"
            ? item.error || "Upload failed"
            : "";

  const openDisabled = Boolean(!href);

  if (isImage && href) {
    return (
      <div className={`wa-attachment-card ${pending ? "pending" : ""}`}>
        <a href={href} target="_blank" rel="noreferrer" className="wa-image-link">
          <img src={href} alt={name} className="wa-image-preview" loading="lazy" />
        </a>

        <div className="wa-attachment-footer">
          <div className="wa-attachment-info">
            <div className="wa-attachment-name">{name}</div>
            <div className="wa-attachment-subtext">
              {[sizeLabel, progressLabel].filter(Boolean).join(" · ")}
            </div>
          </div>

          <div className="wa-attachment-actions">
            <a className="wa-attachment-action" href={href} target="_blank" rel="noreferrer">Open</a>
            {!pending ? <DownloadButton href={href} fileName={name} /> : null}
          </div>
        </div>

        {pending && item.status !== "failed" ? <div className="wa-upload-progress"><span style={{ width: `${progress}%` }} /></div> : null}
      </div>
    );
  }

  return (
    <div className={`wa-attachment-chip ${pending ? "pending" : ""}`}>
      <div className={`wa-file-badge ${isPdf ? "pdf" : ""}`}>{getFileKindLabel(item)}</div>

      <div className="wa-attachment-info">
        <div className="wa-attachment-name">{name}</div>
        <div className="wa-attachment-subtext">
          {[sizeLabel, progressLabel].filter(Boolean).join(" · ") || "File attachment"}
        </div>
      </div>

      <div className="wa-attachment-actions">
        {!pending && !openDisabled ? (
          <>
            <a className="wa-attachment-action" href={href} target="_blank" rel="noreferrer">Open</a>
            <DownloadButton href={href} fileName={name} />
          </>
        ) : item.status === "failed" ? (
          <span className="wa-attachment-failed">Failed</span>
        ) : null}
      </div>

      {pending && item.status !== "failed" ? <div className="wa-upload-progress chip"><span style={{ width: `${progress}%` }} /></div> : null}
    </div>
  );
}

function ReactionBar({ reactions = {}, onReact }) {
  const normalized = normalizeReactions(reactions);
  const entries = Object.entries(normalized).filter(
    ([, users]) => Array.isArray(users) && users.length
  );

  if (!entries.length) return null;

  return (
    <div className="wa-reactions-row">
      {entries.map(([emoji, users]) => (
        <button key={emoji} type="button" className="wa-reaction-pill" onClick={() => onReact(emoji)}>
          <span>{emoji}</span>
          <span>{users.length}</span>
        </button>
      ))}
    </div>
  );
}

function VoiceNotePlayer({
  messageId,
  src,
  mine,
  activeAudioId,
  setActiveAudioId,
  listenedMap,
  markPlayed,
}) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const hasBeenPlayed = Boolean(listenedMap[messageId]);
  const waveBars = useMemo(() => generateWaveBars(38), []);
  const progressPercent = duration ? Math.min((currentTime / duration) * 100, 100) : 0;
  const playedBars = duration ? Math.round((currentTime / duration) * waveBars.length) : 0;
  const remainingTime = Math.max(duration - currentTime, 0);


  useEffect(() => {
    registerPwaServiceWorker();

    const handlePwaBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPwaInstallPrompt(event);
      if (!isStandalonePwa()) setShowPwaInstallPrompt(true);
    };

    const handlePwaInstalled = () => {
      setPwaInstallPrompt(null);
      setShowPwaInstallPrompt(false);
    };

    window.addEventListener(PWA_BEFORE_INSTALL_PROMPT, handlePwaBeforeInstallPrompt);
    window.addEventListener("appinstalled", handlePwaInstalled);

    return () => {
      window.removeEventListener(PWA_BEFORE_INSTALL_PROMPT, handlePwaBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handlePwaInstalled);
    };
  }, []);

  async function installPwaApp() {
    if (!pwaInstallPrompt) {
      setShowPwaInstallPrompt(false);
      return;
    }

    pwaInstallPrompt.prompt();
    await pwaInstallPrompt.userChoice.catch(() => null);
    setPwaInstallPrompt(null);
    setShowPwaInstallPrompt(false);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => {
      const nextTime = audio.currentTime || 0;
      if (!isDragging) setCurrentTime(nextTime);
      if (audio.duration && nextTime / audio.duration >= 0.8) {
        markPlayed(messageId);
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      setActiveAudioId(messageId);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      markPlayed(messageId);
      setCurrentTime(0);
      audio.currentTime = 0;
      setActiveAudioId((current) => (current === messageId ? null : current));
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isDragging, markPlayed, messageId, setActiveAudioId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeAudioId !== messageId && !audio.paused) audio.pause();
  }, [activeAudioId, messageId]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event) => {
      const progressEl = progressRef.current;
      const audio = audioRef.current;
      if (!progressEl || !audio || !duration) return;

      const rect = progressEl.getBoundingClientRect();
      const offsetX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
      const ratio = rect.width ? offsetX / rect.width : 0;
      const nextTime = ratio * duration;

      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    };

    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, duration]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (!audio.paused) {
        audio.pause();
      } else {
        setActiveAudioId(messageId);
        await audio.play();
      }
    } catch (err) {
      console.error("Voice note playback failed", err);
    }
  };

  const seekFromClientX = (clientX) => {
    const progressEl = progressRef.current;
    const audio = audioRef.current;
    if (!progressEl || !audio || !duration) return;

    const rect = progressEl.getBoundingClientRect();
    const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width ? offsetX / rect.width : 0;
    const nextTime = ratio * duration;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeekStart = (event) => {
    event.preventDefault();
    const clientX =
      typeof event.clientX === "number" ? event.clientX : event.touches?.[0]?.clientX;
    if (typeof clientX !== "number") return;

    seekFromClientX(clientX);
    setIsDragging(true);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  return (
    <div className={`wa-voice-note ${mine ? "mine" : ""}`}>
      <audio ref={audioRef} preload="metadata" playsInline src={src} />

      <button
        type="button"
        className="wa-voice-play-btn"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <div className="wa-voice-track">
        <div
          ref={progressRef}
          className="wa-voice-progress"
          onPointerDown={handleSeekStart}
          onClick={(e) => seekFromClientX(e.clientX)}
        >
          <div className="wa-voice-waveform">
            {waveBars.map((height, index) => (
              <span
                key={index}
                className={`wa-voice-wave-bar ${index < playedBars ? "played" : ""}`}
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
          <div className="wa-voice-progress-thumb" style={{ left: `${progressPercent}%` }} />
        </div>

        <div className="wa-voice-time-row">
          <span className="wa-voice-time">
            {hasBeenPlayed ? "✓ " : ""}-{formatPlayerTime(remainingTime)}
          </span>
          <button type="button" className="wa-voice-speed-btn" onClick={cycleSpeed}>
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; padding: 0; height: 100%; }
      body {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #e5e7eb;
        color: #0f172a;
      }

      .wa-app {
        display: grid;
        grid-template-columns: 320px 1fr;
        height: 100vh;
        background: var(--chat-wallpaper, #dbe4ea);
      }

      .wa-sidebar {
        background: #0f172a;
        color: #fff;
        padding: 14px;
        overflow-y: auto;
        border-right: 1px solid rgba(255,255,255,0.08);
      }

      .wa-brand {
        font-size: 20px;
        font-weight: 800;
        margin-bottom: 14px;
      }

      .wa-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
        display: block;
      }

      .wa-avatar.large {
        width: 78px;
        height: 78px;
        font-size: 28px;
      }

      .wa-avatar-upload {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #0f172a;
        font-size: 13px;
        font-weight: 700;
      }

      .wa-profile-edit {
        margin-left: auto;
        opacity: 0.7;
      }

      .wa-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15,23,42,0.52);
        z-index: 80;
        display: grid;
        place-items: center;
        padding: 16px;
      }

      .wa-profile-modal {
        width: min(420px, 100%);
        background: white;
        border-radius: 20px;
        padding: 18px;
        box-shadow: 0 24px 70px rgba(15,23,42,0.3);
        display: grid;
        gap: 12px;
      }

      .wa-modal-title {
        font-size: 18px;
        font-weight: 900;
        color: #0f172a;
      }

      .wa-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .wa-profile-card {
        width: 100%;
        border: none;
        border-radius: 14px;
        padding: 12px;
        text-align: left;
        margin-bottom: 12px;
        background: rgba(255,255,255,0.08);
        color: #fff;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-profile-text {
        min-width: 0;
      }

      .wa-section-label {
        margin: 16px 0 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.62;
      }

      .wa-search-input {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        padding: 10px 12px;
        outline: none;
        font-size: 14px;
        background: white;
        color: #0f172a;
        margin-bottom: 10px;
      }

      .wa-side-switcher {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .wa-side-tab {
        flex: 1 1 0;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: white;
        border-radius: 999px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .wa-side-tab.active {
        background: #0ea5e9;
        border-color: #0ea5e9;
      }

      .wa-room-card,
      .wa-user-card {
        width: 100%;
        border: none;
        border-radius: 14px;
        padding: 12px;
        text-align: left;
        margin-bottom: 8px;
        cursor: pointer;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-room-card {
        background: rgba(255,255,255,0.06);
      }

      .wa-user-card {
        background: rgba(14,165,233,0.10);
        border: 1px solid rgba(14,165,233,0.18);
      }

      .wa-room-card.active,
      .wa-user-card.active {
        background: #0ea5e9;
      }

      .wa-room-content,
      .wa-user-content {
        min-width: 0;
        flex: 1 1 auto;
      }

      .wa-room-row-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .wa-room-title,
      .wa-user-name {
        font-size: 14px;
        font-weight: 700;
      }

      .wa-room-sub,
      .wa-user-sub,
      .wa-profile-sub {
        font-size: 12px;
        opacity: 0.72;
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wa-unread-badge {
        min-width: 20px;
        height: 20px;
        border-radius: 999px;
        background: #22c55e;
        color: white;
        font-size: 11px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
        flex: 0 0 auto;
      }

      .wa-avatar {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: #22c55e;
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 16px;
        flex: 0 0 auto;
      }

      .wa-avatar.header {
        width: 34px;
        height: 34px;
        font-size: 14px;
      }

      .wa-avatar.message {
        width: 30px;
        height: 30px;
        font-size: 13px;
        margin-top: 2px;
      }

      .wa-main {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        min-width: 0;
        height: 100vh;
        overflow: hidden;
        background: #f8fafc;
      }

      .wa-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #dbeafe;
        background: #ffffff;
      }

      .wa-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .wa-header-title-wrap {
        min-width: 0;
      }

      .wa-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .wa-header-title {
        font-size: 18px;
        font-weight: 800;
      }

      .wa-header-sub {
        font-size: 12px;
        color: #64748b;
        margin-top: 2px;
      }

      .wa-message-search-wrap {
        padding: 10px 16px;
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
      }

      .wa-chat {
        position: relative;
        overflow-y: auto;
        min-height: 0;
        padding: 16px 16px 110px;
        scroll-padding-bottom: 120px;
        background:
          radial-gradient(circle at top, rgba(14,165,233,0.06), transparent 32%),
          linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
      }

      .wa-drop-overlay {
        position: absolute;
        inset: 16px;
        border: 2px dashed #0ea5e9;
        border-radius: 18px;
        background: rgba(14, 165, 233, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0369a1;
        font-size: 20px;
        font-weight: 700;
        z-index: 5;
        pointer-events: none;
      }

      .wa-day-separator {
        display: flex;
        justify-content: center;
        margin: 12px 0;
      }

      .wa-day-pill {
        background: rgba(15,23,42,0.08);
        color: #475569;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }

      .wa-message-row {
        display: flex;
        margin-bottom: 10px;
      }

      .wa-message-row.mine {
        justify-content: flex-end;
      }

      .wa-message-row.other {
        justify-content: flex-start;
      }

      .wa-message-row.pending {
        opacity: 0.96;
      }

      .wa-message-other-wrap {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        max-width: min(720px, 92vw);
      }

      .wa-message-content-wrap {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .wa-sender-name {
        display: inline-flex;
        align-items: center;
        max-width: min(640px, 78vw);
        font-size: 12px;
        font-weight: 800;
        color: #0284c7;
        margin: 0 0 4px 10px;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wa-bubble {
        position: relative;
        max-width: min(640px, 78vw);
        padding: 10px 12px 8px;
        border-radius: 16px;
        background: white;
        box-shadow: 0 4px 16px rgba(15,23,42,0.06);
      }

      .wa-bubble.mine {
        background: #dcfce7;
      }

      .wa-app.bubble-soft .wa-bubble { border-radius: 10px; }
      .wa-app.bubble-square .wa-bubble { border-radius: 4px; }
      .wa-app.font-small .wa-message-text, .wa-app.font-small .wa-input { font-size: 13px; }
      .wa-app.font-large .wa-message-text, .wa-app.font-large .wa-input { font-size: 17px; }
      .wa-settings-card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; padding: 12px; margin-bottom: 12px; display: grid; gap: 10px; }
      .wa-settings-title { font-weight: 900; font-size: 14px; }
      .wa-settings-note { font-size: 12px; color: rgba(255,255,255,0.72); line-height: 1.35; }
      .wa-search-input.light, .wa-select { width: 100%; border: none; border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.92); color: #0f172a; }
      .wa-settings-btn { border: none; border-radius: 12px; padding: 10px 12px; background: #22c55e; color: white; font-weight: 900; cursor: pointer; }
      .wa-settings-label { display: grid; gap: 6px; font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.84); }
      .wa-color-input { width: 100%; height: 38px; border: none; border-radius: 12px; background: transparent; }

      .wa-bubble.pending {
        box-shadow: 0 8px 24px rgba(14, 165, 233, 0.12);
      }

      .wa-reply-card,
      .wa-forward-label {
        margin-bottom: 8px;
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(15,23,42,0.06);
        font-size: 12px;
      }

      .wa-forward-label {
        color: #0284c7;
        font-weight: 700;
      }

      .wa-reply-sender {
        font-weight: 700;
        margin-bottom: 4px;
        color: #0284c7;
      }

      .wa-message-text {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.45;
      }

      .wa-message-text.deleted {
        font-style: italic;
        color: #64748b;
      }

      .wa-meta {
        margin-top: 6px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        font-size: 11px;
        color: #64748b;
        align-items: center;
        flex-wrap: wrap;
      }

      .wa-audio-wrap {
        width: min(280px, calc(100vw - 112px));
        min-width: min(180px, calc(100vw - 112px));
      }

      .wa-audio-label {
        font-size: 12px;
        font-weight: 700;
        color: #0284c7;
        margin-bottom: 6px;
      }

      .wa-voice-note {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-width: 0;
        max-width: 260px;
      }

      .wa-voice-play-btn {
        flex: 0 0 36px;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: none;
        background: #0ea5e9;
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
      }

      .wa-voice-note.mine .wa-voice-play-btn {
        background: #0284c7;
      }

      .wa-voice-track {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .wa-voice-progress {
        position: relative;
        height: 28px;
        display: flex;
        align-items: center;
        cursor: pointer;
        touch-action: none;
      }

      .wa-voice-waveform {
        width: 100%;
        height: 24px;
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .wa-voice-wave-bar {
        width: 3px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.18);
        flex: 0 0 auto;
      }

      .wa-voice-wave-bar.played {
        background: #0ea5e9;
      }

      .wa-voice-note.mine .wa-voice-wave-bar.played {
        background: #0284c7;
      }

      .wa-voice-progress-thumb {
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #0ea5e9;
        transform: translate(-50%, -50%);
      }

      .wa-voice-time-row {
        margin-top: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .wa-voice-time {
        font-size: 11px;
        color: #64748b;
        user-select: none;
      }

      .wa-voice-speed-btn {
        border: none;
        background: transparent;
        color: #0f172a;
        font-size: 11px;
        font-weight: 700;
        padding: 0;
        cursor: pointer;
      }

      .wa-attachment-card {
        width: min(320px, 62vw);
        overflow: hidden;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.22);
      }

      .wa-bubble.mine .wa-attachment-card {
        background: rgba(255, 255, 255, 0.5);
      }

      .wa-image-link {
        display: block;
        line-height: 0;
      }

      .wa-image-preview {
        display: block;
        width: 100%;
        max-height: 280px;
        object-fit: cover;
        background: #e2e8f0;
      }

      .wa-attachment-footer,
      .wa-attachment-chip {
        position: relative;
      }

      .wa-attachment-footer {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px 12px;
      }

      .wa-attachment-chip {
        min-width: 240px;
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.22);
      }

      .wa-file-badge {
        flex: 0 0 auto;
        min-width: 44px;
        height: 44px;
        border-radius: 12px;
        background: #dbeafe;
        color: #1d4ed8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 0 8px;
      }

      .wa-file-badge.pdf {
        background: #fee2e2;
        color: #b91c1c;
      }

      .wa-attachment-info {
        min-width: 0;
        flex: 1 1 auto;
      }

      .wa-attachment-name {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wa-attachment-subtext {
        font-size: 11px;
        color: #64748b;
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wa-attachment-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex: 0 0 auto;
      }

      .wa-attachment-action,
      .wa-attachment-failed,
      .wa-meta-btn {
        font-size: 12px;
        font-weight: 700;
        color: #0284c7;
        text-decoration: none;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
      }

      .wa-attachment-failed {
        color: #dc2626;
      }

      .wa-upload-progress {
        height: 5px;
        background: rgba(148, 163, 184, 0.2);
        border-radius: 999px;
        overflow: hidden;
        margin-top: 8px;
      }

      .wa-upload-progress.chip {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 8px;
        margin-top: 0;
      }

      .wa-upload-progress span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #38bdf8, #0ea5e9);
        border-radius: inherit;
      }

      .wa-uploading-audio {
        font-size: 12px;
        color: #475569;
      }

      .wa-reactions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .wa-reaction-pill {
        border: none;
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 999px;
        padding: 4px 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        cursor: pointer;
      }

      .wa-reaction-picker,
      .wa-chat-emoji-picker {
        position: fixed;
        z-index: 50;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        background: white;
        border: 1px solid rgba(148,163,184,0.22);
        box-shadow: 0 16px 40px rgba(15,23,42,0.18);
        border-radius: 18px;
        padding: 8px 10px;
        max-width: min(92vw, 360px);
        max-height: min(42vh, 260px);
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .wa-reaction-option,
      .wa-reaction-close,
      .wa-chat-emoji-option,
      .wa-chat-emoji-close {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 34px;
      }

      .wa-reaction-close,
      .wa-chat-emoji-close {
        font-size: 16px;
        color: #64748b;
      }

      .wa-composer {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 7px 10px;
        border-top: 1px solid #dbeafe;
        background: white;
        min-height: 52px;
        max-width: 100%;
      }

      .wa-input-wrap {
        flex: 1 1 auto;
        min-width: 120px;
      }

      .wa-input {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        padding: 10px 12px;
        outline: none;
        font-size: 14px;
      }

      .wa-icon-btn,
      .wa-send-btn {
        border: none;
        cursor: pointer;
        border-radius: 999px;
      }

      .wa-icon-btn {
        width: 38px;
        height: 38px;
        background: #e2e8f0;
        font-size: 17px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .wa-icon-btn.call-action,
      .wa-icon-btn.calling {
        background: #22c55e;
        color: white;
      }

      .wa-call-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 17px;
        line-height: 1;
      }

      .wa-recording-status {
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        color: #dc2626;
      }

      .wa-recording-panel,
      .wa-voice-preview {
        margin-bottom: 8px;
        padding: 10px;
        border-radius: 14px;
        background: #fee2e2;
        border: 1px solid #fecaca;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .wa-voice-preview {
        background: #e0f2fe;
        border-color: #bae6fd;
      }

      .wa-recording-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #dc2626;
        animation: waPulse 1s infinite;
      }

      .wa-recording-timer {
        font-size: 13px;
        font-weight: 900;
        color: #991b1b;
      }

      .wa-mini-btn {
        border: 0;
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        background: #ffffff;
        color: #0f172a;
      }

      .wa-mini-btn.danger {
        background: #dc2626;
        color: #ffffff;
      }

      .wa-mini-btn.primary {
        background: #0ea5e9;
        color: #ffffff;
      }

      @keyframes waPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.82); }
      }

      .wa-icon-btn.recording {
        background: #ef4444;
        color: white;
      }

      .wa-send-btn {
        background: #0ea5e9;
        color: white;
        padding: 12px 18px;
        font-weight: 800;
      }

      .wa-error {
        margin: 8px 16px 0;
        background: #fee2e2;
        color: #b91c1c;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 13px;
      }

      .wa-empty {
        padding: 24px;
        text-align: center;
        color: #64748b;
      }

      .wa-name-setup {
        display: grid;
        gap: 10px;
        max-width: 360px;
        margin: 48px auto;
        background: white;
        padding: 20px;
        border-radius: 18px;
        box-shadow: 0 10px 30px rgba(15,23,42,0.08);
      }

      .wa-name-setup h2 {
        margin: 0 0 4px;
      }

      .wa-call-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 999px;
        background: #dcfce7;
        color: #166534;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }

      .wa-incoming-call {
        position: fixed;
        left: 50%;
        top: 20px;
        transform: translateX(-50%);
        z-index: 80;
        width: min(420px, calc(100vw - 28px));
        border-radius: 22px;
        background: #0f172a;
        color: #fff;
        padding: 16px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
        touch-action: none;
        user-select: none;
      }

      .wa-call-floating.is-dragging {
        cursor: grabbing;
      }

      .wa-incoming-title {
        font-weight: 900;
        font-size: 16px;
        margin-bottom: 4px;
      }

      .wa-incoming-sub {
        color: #cbd5e1;
        font-size: 13px;
        margin-bottom: 14px;
      }

      .wa-incoming-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .wa-call-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: #0f172a;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        overflow: hidden;
      }

      .wa-call-card {
        width: min(420px, 92vw);
        max-height: calc(100vh - 36px);
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 24px;
        padding: 24px;
        text-align: center;
        box-shadow: 0 24px 80px rgba(0,0,0,0.28);
        overflow: hidden;
      }

      .wa-call-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 10px;
      }

      .wa-call-card-head-main {
        min-width: 0;
        flex: 1;
      }

      .wa-call-minimize {
        border: none;
        border-radius: 999px;
        background: rgba(255,255,255,0.14);
        color: white;
        width: 36px;
        height: 36px;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
      }

      .wa-call-floating {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 95;
        width: 190px;
        height: 190px;
        background: #020617;
        color: white;
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
        touch-action: none;
        user-select: none;
        cursor: grab;
      }

      .wa-call-floating.audio-only {
        width: min(300px, calc(100vw - 28px));
        height: 178px;
      }

      .wa-call-floating.is-dragging {
        cursor: grabbing;
      }

      .wa-call-floating-video-preview {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #020617;
        position: relative;
      }

      .wa-call-floating-video-preview video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
      }

      .wa-call-floating-video-label {
        position: absolute;
        left: 8px;
        top: 8px;
        max-width: calc(100% - 52px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-radius: 999px;
        padding: 3px 7px;
        font-size: 10px;
        font-weight: 900;
        background: rgba(15,23,42,0.76);
        color: white;
        backdrop-filter: blur(6px);
      }

      .wa-call-floating-open {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 999px;
        background: rgba(15,23,42,0.74);
        color: white;
        font-size: 14px;
        font-weight: 900;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .wa-call-floating-audio-state {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 18px 14px 48px;
      }

      .wa-call-floating-title {
        font-weight: 900;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .wa-call-floating-sub {
        color: #cbd5e1;
        font-size: 12px;
        margin-top: 3px;
      }

      .wa-call-floating-controls {
        position: absolute;
        left: 6px;
        right: 6px;
        bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 5px;
        padding: 5px;
        border-radius: 999px;
        background: rgba(15,23,42,0.62);
        backdrop-filter: blur(8px);
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .wa-call-floating.show-controls .wa-call-floating-controls,
      .wa-call-floating:hover .wa-call-floating-controls,
      .wa-call-card.show-controls .wa-call-actions,
      .wa-call-card:hover .wa-call-actions {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .wa-call-icon-btn {
        width: 27px;
        height: 27px;
        border: none;
        border-radius: 999px;
        background: rgba(255,255,255,0.18);
        color: white;
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        line-height: 1;
        padding: 0;
      }

      .wa-call-icon-btn.is-active {
        background: rgba(245,158,11,0.88);
      }

      .wa-call-icon-btn.danger {
        background: #dc2626;
      }

      .wa-call-title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 6px;
      }

      .wa-call-subtitle {
        font-size: 13px;
        opacity: 0.72;
        margin-bottom: 20px;
      }

      .wa-call-participants {
        display: grid;
        gap: 10px;
        margin-bottom: 22px;
      }

      .wa-call-person {
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: flex-start;
        font-weight: 700;
        padding: 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.14);
      }

      .wa-screen-share-grid {
        display: grid;
        gap: 10px;
        margin: 0 0 18px;
      }

      .wa-screen-video {
        width: 100%;
        max-height: 260px;
        border-radius: 16px;
        background: #020617;
        border: 1px solid rgba(255,255,255,0.16);
      }

      .wa-video-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 12px;
        margin: 0 0 18px;
        width: 100%;
      }

      .wa-video-tile {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        background: #020617;
        border: 1px solid rgba(255,255,255,0.16);
        aspect-ratio: 16 / 9;
        min-height: 180px;
        box-shadow: 0 12px 36px rgba(0,0,0,0.22);
      }

      .wa-video-tile video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        background: #020617;
      }

      .wa-video-label {
        position: absolute;
        left: 10px;
        bottom: 10px;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 800;
        background: rgba(15,23,42,0.76);
        color: white;
      }

      .wa-call-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .wa-call-btn {
        border: none;
        border-radius: 999px;
        width: 46px;
        height: 46px;
        padding: 0;
        font-size: 18px;
        font-weight: 900;
        cursor: pointer;
        background: rgba(255,255,255,0.16);
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .wa-call-btn.danger {
        background: #ef4444;
        color: white;
      }

      .wa-call-btn.secondary {
        background: rgba(255,255,255,0.14);
        color: white;
      }

      .wa-call-log-card {
        border-radius: 14px;
        padding: 12px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.10);
      }

      .wa-call-log-status {
        font-size: 11px;
        font-weight: 900;
        color: #86efac;
      }

      .wa-call-log-status.missed {
        color: #fca5a5;
      }

      .wa-empty.dark {
        color: rgba(255,255,255,0.72);
        padding: 12px 0;
      }

      .wa-call-card.video-active {
        width: min(1120px, 96vw);
        height: min(760px, 92vh);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto auto;
        gap: 14px;
        text-align: left;
      }

      .wa-call-card.video-active .wa-call-card-head {
        margin-bottom: 0;
      }

      .wa-call-card.video-active .wa-video-grid {
        min-height: 0;
        max-height: 100%;
        height: 100%;
        overflow: hidden;
        align-content: stretch;
        padding-right: 0;
        margin-bottom: 0;
      }

      .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:only-child) {
        grid-template-columns: minmax(0, 1fr);
      }

      .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child),
      .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .wa-call-card.video-active .wa-video-tile {
        min-height: 0;
      }

      .wa-call-card.video-active .wa-call-participants {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        margin-bottom: 0;
        padding-bottom: 2px;
        -webkit-overflow-scrolling: touch;
      }

      .wa-call-card.video-active .wa-call-person {
        flex: 0 0 auto;
        padding: 8px 10px;
      }

      .wa-call-card.video-active .wa-call-actions {
        justify-content: center;
      }

      .wa-call-card.screen-active {
        width: min(1180px, 96vw);
        height: min(760px, 92vh);
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 14px;
        text-align: left;
      }

      .wa-call-card.screen-active .wa-call-card-head {
        grid-column: 1 / -1;
        margin-bottom: 0;
      }

      .wa-call-card.screen-active .wa-screen-share-grid {
        grid-column: 2;
        grid-row: 2;
        margin: 0;
        height: 100%;
        min-width: 0;
      }

      .wa-call-card.screen-active .wa-screen-video {
        height: 100%;
        max-height: none;
        object-fit: contain;
      }

      .wa-call-card.screen-active .wa-video-grid,
      .wa-call-card.screen-active .wa-call-participants {
        grid-column: 1;
        grid-row: 2;
        align-content: start;
        margin-bottom: 0;
        overflow-y: auto;
      }

      .wa-call-card.screen-active .wa-video-grid {
        grid-template-columns: 1fr;
      }

      .wa-call-card.screen-active .wa-video-tile {
        min-height: 120px;
        aspect-ratio: 16 / 9;
      }

      .wa-call-card.screen-active .wa-call-actions {
        grid-column: 1 / -1;
      }

      .wa-mobile-overlay {
        display: none;
      }

      @media (max-width: 900px) {
        .wa-app {
          grid-template-columns: 1fr;
        }

        .wa-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 82vw;
          max-width: 260px;
          z-index: 40;
          transform: translateX(-100%);
          transition: transform 0.22s ease;
          display: block;
        }

        .wa-sidebar.open {
          transform: translateX(0);
        }

        .wa-mobile-overlay {
          display: block;
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 30;
        }

        .wa-main {
          grid-column: 1 / -1;
          width: 100vw;
          max-width: 100vw;
        }

        .wa-attachment-card {
          width: min(100%, 280px);
        }

        .wa-attachment-chip {
          min-width: 0;
          width: 100%;
        }

        .wa-chat {
          padding: 12px 10px 92px;
          scroll-padding-bottom: 82px;
          overflow-x: hidden;
          width: 100%;
          max-width: 100vw;
        }

        .wa-message-row,
        .wa-message-other-wrap,
        .wa-message-content-wrap {
          max-width: 100%;
        }

        .wa-bubble {
          max-width: min(88vw, 360px);
          overflow-wrap: anywhere;
        }

        .wa-composer {
          gap: 6px;
          padding: 7px 8px;
          min-height: 54px;
        }

        .wa-icon-btn {
          width: 34px;
          height: 34px;
          font-size: 15px;
          flex: 0 0 34px;
        }

        .wa-input-wrap {
          min-width: 0;
        }

        .wa-input {
          padding: 9px 10px;
          font-size: 13px;
        }

        .wa-send-btn {
          padding: 10px 12px;
          font-size: 12px;
        }

        .wa-call-overlay {
          padding: 10px;
          align-items: stretch;
        }

        .wa-call-card,
        .wa-call-card.video-active,
        .wa-call-card.screen-active {
          width: 100%;
          height: calc(100dvh - 20px);
          max-height: calc(100dvh - 20px);
          border-radius: 20px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: auto minmax(0, 1fr) auto auto;
          text-align: left;
          overflow: hidden;
        }

        .wa-call-card.video-active .wa-video-grid,
        .wa-call-card.screen-active .wa-video-grid {
          grid-template-columns: 1fr !important;
          grid-auto-rows: minmax(0, 1fr);
          overflow: hidden;
          align-content: stretch;
          max-height: 100%;
          height: 100%;
          min-height: 0;
          padding-right: 0;
        }

        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:only-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:only-child) {
          grid-template-rows: minmax(0, 1fr);
        }

        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child) {
          grid-template-rows: repeat(2, minmax(0, 1fr));
        }

        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child),
        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child) {
          overflow-y: auto;
          grid-auto-rows: minmax(150px, 1fr);
        }

        .wa-call-card.video-active .wa-video-tile,
        .wa-call-card.screen-active .wa-video-tile {
          min-height: 0;
          height: 100%;
          aspect-ratio: 16 / 9;
        }

        .wa-video-tile video {
          object-fit: contain;
        }

        .wa-call-card.video-active .wa-call-participants,
        .wa-call-card.screen-active .wa-call-participants {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          margin-bottom: 0;
          padding-bottom: 2px;
        }

        .wa-call-card.screen-active .wa-screen-share-grid {
          grid-column: 1;
          grid-row: 2;
        }

        .wa-call-actions {
          gap: 8px;
        }

        .wa-call-btn {
          padding: 10px 12px;
          font-size: 13px;
        }
      }


      @media (max-width: 760px) {
        html, body, #root {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        .wa-shell,
        .wa-main,
        .wa-chat-panel,
        .wa-chat-shell,
        .wa-chat,
        .wa-topbar,
        .wa-composer {
          width: 100%;
          max-width: 100vw;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .wa-chat-emoji-picker,
        .wa-reaction-picker {
          left: 8px !important;
          right: 8px !important;
          top: auto !important;
          bottom: 68px !important;
          max-width: none;
          width: auto;
          display: grid;
          grid-template-columns: repeat(8, minmax(30px, 1fr));
          gap: 6px;
          max-height: 220px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .wa-chat-emoji-close,
        .wa-reaction-close {
          position: sticky;
          right: 0;
          bottom: 0;
          background: #fff;
          border-radius: 999px;
        }
      }

      @media (max-width: 420px) {
        .wa-bubble {
          max-width: 84vw;
        }

        .wa-voice-note,
        .wa-audio-wrap,
        .wa-attachment-card {
          max-width: 68vw;
        }
      }

      /* Video call fit fix: fill the available call area without internal scrolling. */
      .wa-video-tile video {
        object-fit: cover;
        background: #020617;
      }

      .wa-call-card.video-active .wa-video-grid,
      .wa-call-card.screen-active .wa-video-grid {
        overflow: hidden !important;
      }

      @media (max-width: 900px) {
        .wa-call-card.video-active,
        .wa-call-card.screen-active {
          height: 100dvh !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          padding: 10px !important;
          grid-template-rows: auto minmax(0, 1fr) auto auto !important;
        }

        .wa-call-card.video-active .wa-video-grid,
        .wa-call-card.screen-active .wa-video-grid {
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
          gap: 8px !important;
          align-content: stretch !important;
          grid-template-columns: 1fr !important;
          grid-template-rows: minmax(0, 1fr) !important;
          grid-auto-rows: minmax(0, 1fr) !important;
        }

        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child) {
          grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
        }

        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child),
        .wa-call-card.video-active .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child),
        .wa-call-card.screen-active .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child) {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
        }

        .wa-call-card.video-active .wa-video-tile,
        .wa-call-card.screen-active .wa-video-tile {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: none !important;
          aspect-ratio: auto !important;
        }

        .wa-call-card.video-active .wa-video-tile video,
        .wa-call-card.screen-active .wa-video-tile video {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: none !important;
          object-fit: cover !important;
        }

        .wa-call-actions {
          flex-shrink: 0;
        }

        .wa-message-other-wrap {
          max-width: calc(100vw - 26px);
        }

        .wa-sender-name {
          max-width: calc(100vw - 92px);
          margin-left: 8px;
        }

        .wa-call-floating {
          width: 168px;
          height: 168px;
          right: 12px;
          bottom: 12px;
        }

        .wa-call-floating.audio-only {
          width: min(240px, calc(100vw - 24px));
          height: 136px;
        }

        .wa-call-floating-controls {
          left: 5px;
          right: 5px;
          bottom: 5px;
          gap: 4px;
          padding: 4px;
        }

        .wa-call-icon-btn {
          width: 26px;
          height: 26px;
          font-size: 12px;
        }
      }

      .wa-audio-call-fill { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 35%, rgba(34,197,94,0.30), rgba(2,6,23,1) 58%); }
      .wa-audio-call-pulse { width: 116px; height: 116px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 48px; background: rgba(34,197,94,0.24); box-shadow: 0 0 0 18px rgba(34,197,94,0.08); }
      /* Immersive call update: video fills the screen; all UI is overlay-only. */
      .wa-incoming-call { width: min(340px, calc(100vw - 24px)) !important; padding: 12px !important; border-radius: 16px !important; }
      .wa-incoming-title { font-size: 14px !important; margin-bottom: 2px !important; }
      .wa-incoming-sub { font-size: 11px !important; margin-bottom: 8px !important; }
      .wa-incoming-actions { gap: 6px !important; }
      .wa-incoming-actions .wa-call-btn { width: auto !important; height: 34px !important; padding: 0 12px !important; font-size: 12px !important; }
      .wa-call-overlay { padding: 0 !important; align-items: stretch !important; justify-content: stretch !important; background: #020617 !important; }
      .wa-call-card, .wa-call-card.video-active, .wa-call-card.screen-active { width: 100vw !important; height: 100dvh !important; max-width: none !important; max-height: none !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; background: #020617 !important; box-shadow: none !important; display: block !important; position: relative !important; overflow: hidden !important; }
      .wa-call-card-head { position: absolute !important; left: 14px !important; right: 14px !important; top: 12px !important; z-index: 6 !important; margin: 0 !important; padding: 10px 12px !important; border-radius: 16px !important; background: rgba(2,6,23,0.48) !important; backdrop-filter: blur(10px) !important; opacity: 0 !important; pointer-events: none !important; transform: translateY(-8px) !important; transition: opacity 160ms ease, transform 160ms ease !important; }
      .wa-call-card.show-controls .wa-call-card-head, .wa-call-card:hover .wa-call-card-head { opacity: 1 !important; pointer-events: auto !important; transform: translateY(0) !important; }
      .wa-call-title { font-size: 15px !important; margin: 0 0 2px !important; }
      .wa-call-subtitle { font-size: 12px !important; margin: 0 !important; }
      .wa-call-minimize { width: 34px !important; height: 34px !important; flex: 0 0 34px !important; }
      .wa-call-card .wa-video-grid, .wa-call-card.video-active .wa-video-grid, .wa-call-card.screen-active .wa-video-grid { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; display: grid !important; overflow: hidden !important; }
      .wa-call-card .wa-video-grid:has(.wa-video-tile:only-child) { grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; }
      .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; grid-template-rows: 1fr !important; }
      .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child), .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; grid-template-rows: repeat(2, minmax(0, 1fr)) !important; }
      .wa-call-card .wa-video-tile, .wa-call-card.video-active .wa-video-tile, .wa-call-card.screen-active .wa-video-tile { width: 100% !important; height: 100% !important; min-height: 0 !important; aspect-ratio: auto !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      .wa-call-card .wa-video-tile video { width: 100% !important; height: 100% !important; object-fit: contain !important; background: #000 !important; }
      .wa-call-participants { position: absolute !important; left: 14px !important; bottom: 82px !important; z-index: 5 !important; margin: 0 !important; display: flex !important; gap: 6px !important; max-width: calc(100vw - 28px) !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; transition: opacity 160ms ease !important; }
      .wa-call-card.show-controls .wa-call-participants, .wa-call-card:hover .wa-call-participants { opacity: 1 !important; }
      .wa-call-person { padding: 6px 9px !important; border-radius: 999px !important; font-size: 12px !important; background: rgba(2,6,23,0.52) !important; backdrop-filter: blur(8px) !important; }
      .wa-call-person .wa-avatar { display: none !important; }
      .wa-call-actions { position: absolute !important; left: 50% !important; bottom: 18px !important; z-index: 7 !important; transform: translate(-50%, 10px) !important; padding: 8px !important; border-radius: 999px !important; background: rgba(2,6,23,0.58) !important; backdrop-filter: blur(12px) !important; }
      .wa-call-card.show-controls .wa-call-actions, .wa-call-card:hover .wa-call-actions { transform: translate(-50%, 0) !important; }
      .wa-call-btn { width: 44px !important; height: 44px !important; padding: 0 !important; font-size: 18px !important; }
      .wa-call-floating { width: 220px !important; height: 220px !important; }
      .wa-call-floating.audio-only { width: 220px !important; height: 150px !important; }
      @media (max-width: 760px) { .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(2):last-child) { grid-template-columns: 1fr !important; grid-template-rows: repeat(2, minmax(0, 1fr)) !important; } .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(3):last-child), .wa-call-card .wa-video-grid:has(.wa-video-tile:nth-child(4):last-child) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; grid-template-rows: repeat(2, minmax(0, 1fr)) !important; } .wa-call-card-head { left: 10px !important; right: 10px !important; top: 8px !important; } .wa-call-actions { bottom: 14px !important; gap: 7px !important; } .wa-call-btn { width: 42px !important; height: 42px !important; } .wa-call-floating { width: 190px !important; height: 190px !important; } .wa-incoming-call { top: 10px !important; } }
      /* Video fit policy: fullscreen uses contain; thumbnails/minimized use cover. */
      .wa-call-card .wa-video-tile video,
      .wa-call-card.video-active .wa-video-tile video,
      .wa-call-card.screen-active .wa-video-tile video {
        object-fit: contain !important;
        background: #000 !important;
      }
      .wa-call-floating-video-preview video,
      .wa-call-floating video {
        object-fit: cover !important;
        background: #000 !important;
      }

      /* Theme color preferences */
      .wa-app { background: var(--app-color, #0f172a) !important; }
      .wa-brand, .wa-section-label { color: var(--accent-color, #22c55e) !important; }
      .wa-settings-btn, .wa-call-btn:not(.danger):not(.secondary), .wa-icon-btn.call-action { background: var(--accent-color, #22c55e) !important; }
      .wa-bubble.mine { background: var(--chat-color, #dcfce7) !important; }
      .wa-details-back { border: none; background: #0f172a; color: white; border-radius: 999px; min-width: 118px; height: 40px; padding: 0 14px; font-size: 14px; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 8px 18px rgba(15,23,42,0.16); }
      .wa-details-back:hover { filter: brightness(1.05); }
      .wa-details-topbar { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; gap: 10px; margin: -18px -18px 12px; padding: 14px 18px; background: rgba(248,250,252,0.96); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(15,23,42,0.08); }


      .wa-header-title-wrap.clickable { border: 0; background: transparent; text-align: left; padding: 0; cursor: pointer; color: inherit; }
      .wa-room-context-menu { position: fixed; z-index: 10000; min-width: 190px; padding: 8px; border-radius: 14px; background: #fff; box-shadow: 0 18px 45px rgba(15,23,42,0.24); border: 1px solid rgba(148,163,184,0.22); }
      .wa-room-context-menu button { width: 100%; border: 0; background: transparent; border-radius: 10px; padding: 10px 12px; text-align: left; cursor: pointer; font-weight: 700; color: #0f172a; }
      .wa-room-context-menu button:hover { background: #f1f5f9; }
      .wa-room-context-menu button.danger { color: #dc2626; }
      .wa-details-page { flex: 1; overflow-y: auto; padding: 18px; background: var(--chat-wallpaper); }
      .wa-details-hero { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.82); box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
      .wa-details-hero h2 { margin: 6px 0 0; font-size: 22px; }
      .wa-details-hero p { margin: 0; color: #64748b; }
      .wa-avatar.details { width: 86px; height: 86px; font-size: 30px; }
      .wa-details-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
      .wa-details-actions button, .wa-danger-text-btn { border: 0; border-radius: 14px; padding: 12px; background: white; box-shadow: 0 8px 18px rgba(15,23,42,0.08); cursor: pointer; font-weight: 700; }
      .wa-details-card { margin-top: 14px; padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.88); box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
      .wa-details-card-title { font-weight: 800; margin-bottom: 10px; }
      .wa-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .wa-media-item { min-height: 86px; border-radius: 14px; background: #f8fafc; color: #0f172a; text-decoration: none; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; padding: 10px; text-align: center; overflow: hidden; }
      .wa-media-item span { font-size: 24px; }
      .wa-media-item small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .danger-zone { display: flex; flex-direction: column; gap: 8px; }
      .wa-danger-text-btn { color: #dc2626; text-align: left; }
      @media (max-width: 760px) { .wa-details-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } .wa-room-context-menu { min-width: 210px; } }
      .wa-call-log-action {
        width: 100%;
        text-align: left;
        border: 0;
        cursor: pointer;
      }
      .wa-call-log-action:hover {
        filter: brightness(1.04);
      }
      .wa-call-log-status.rejected {
        background: rgba(245, 158, 11, 0.18);
        color: #f59e0b;
      }

      .wa-global-search-results {
        display: grid;
        gap: 8px;
        margin: 8px 0 12px;
      }

      .wa-search-result-card {
        width: 100%;
        border: 0;
        background: rgba(255,255,255,0.08);
        color: inherit;
        text-align: left;
        border-radius: 14px;
        padding: 10px;
        cursor: pointer;
      }

      .wa-search-result-card:hover {
        background: rgba(255,255,255,0.14);
      }

      .wa-message-row.search-highlight .wa-bubble {
        outline: 3px solid rgba(250, 204, 21, 0.95);
        box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.22);
      }
    `}


</style>
  );
}

function MessageBubble({
  message,
  highlightedMessageId = "",
  currentProfileId,
  activeAudioId,
  setActiveAudioId,
  listenedMap,
  markPlayed,
  onReply,
  onDelete,
  onOpenReactionPicker,
  onStartLongPressReaction,
  onCancelLongPressReaction,
  onReact,
  onForward,
  onToggleStar,
  onTogglePin,
  isGroupChat,
  getProfileNameById = null,
  getProfileAvatarById = null,
}) {
  const mine = String(message.senderProfileId || "") === String(currentProfileId || "");
  const isStarredByMe = Array.isArray(message.starredBy)
    ? message.starredBy.some((id) => String(id) === String(currentProfileId || ""))
    : false;
  const isPinned = Boolean(message.pinned);
  const senderDisplayName = mine
    ? "Me"
    : typeof getProfileNameById === "function"
      ? getProfileNameById(message.senderProfileId, message.sender || "User")
      : message.sender || "User";

  const senderAvatarUrl = !mine && typeof getProfileAvatarById === "function"
    ? getProfileAvatarById(message.senderProfileId)
    : "";

  const content = (
    <>
      {message.forwardedFrom?.sender ? (
        <div className="wa-forward-label">Forwarded from {message.forwardedFrom.sender}</div>
      ) : null}

      {(isPinned || isStarredByMe) ? (
        <div className="wa-message-flag-row">
          {isPinned ? <span className="wa-message-flag">📌 Pinned</span> : null}
          {isStarredByMe ? <span className="wa-message-flag">⭐ Starred</span> : null}
        </div>
      ) : null}

      {message.replyTo?.messageId ? (
        <div className="wa-reply-card">
          <div className="wa-reply-sender">{message.replyTo.sender}</div>
          <div>{message.replyTo.fileName || message.replyTo.content}</div>
        </div>
      ) : null}

      {message.type === "audio" && !message.isDeleted ? (
        <div className="wa-audio-wrap">
          <div className="wa-audio-label">🎤 Voice note</div>
          <VoiceNotePlayer
            messageId={message._id || message.id}
            src={resolveMediaUrl(message.fileUrl)}
            mine={mine}
            activeAudioId={activeAudioId}
            setActiveAudioId={setActiveAudioId}
            listenedMap={listenedMap}
            markPlayed={markPlayed}
          />
        </div>
      ) : message.type === "file" && !message.isDeleted ? (
        <AttachmentPreview item={message} />
      ) : (
        <div className={`wa-message-text ${message.isDeleted ? "deleted" : ""}`}>{message.content}</div>
      )}

      <ReactionBar reactions={message.reactions} onReact={(emoji) => onReact(message._id, emoji)} />

      <div className="wa-meta">
        <span>{formatTime(message.createdAt)}</span>
        {mine ? <span>{message.status || "sent"}</span> : null}
        {!message.isDeleted ? (
          <>
            <button
              type="button"
              className="wa-meta-btn"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenReactionPicker(message, {
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                });
              }}
            >
              😊
            </button>
            <button type="button" className="wa-meta-btn" onClick={() => onReply(message)}>
              Reply
            </button>
            <button type="button" className="wa-meta-btn" onClick={() => onForward(message)}>
              Forward
            </button>
            <button type="button" className="wa-meta-btn" onClick={() => onToggleStar(message)}>
              {isStarredByMe ? "Unstar" : "Star"}
            </button>
            <button type="button" className="wa-meta-btn" onClick={() => onTogglePin(message)}>
              {isPinned ? "Unpin" : "Pin"}
            </button>
            {mine ? (
              <button type="button" className="wa-meta-btn" onClick={() => onDelete(message._id)}>
                Delete
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );

  if (mine) {
    return (
      <div
        className={`wa-message-row mine ${String(message._id || "") === String(highlightedMessageId || "") ? "search-highlight" : ""}`}
        data-message-id={String(message._id || "")}
      >
        <div className="wa-bubble mine">{content}</div>
      </div>
    );
  }

  return (
    <div
      className={`wa-message-row other ${String(message._id || "") === String(highlightedMessageId || "") ? "search-highlight" : ""}`}
      data-message-id={String(message._id || "")}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenReactionPicker(message, { x: e.clientX, y: e.clientY });
      }}
      onTouchStart={(e) => onStartLongPressReaction(message, e)}
      onTouchEnd={onCancelLongPressReaction}
      onTouchMove={onCancelLongPressReaction}
    >
      <div className="wa-message-other-wrap">
        <Avatar label={senderDisplayName} src={senderAvatarUrl} className="message" />

        <div className="wa-message-content-wrap">
          {isGroupChat ? <div className="wa-sender-name">{senderDisplayName}</div> : null}
          <div className="wa-bubble">{content}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const installId = useMemo(() => getOrCreateInstallId(), []);

  const [session, setSession] = useState(null);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [showPwaInstallPrompt, setShowPwaInstallPrompt] = useState(false);
  const [profile, setProfile] = useState(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileStatusInput, setProfileStatusInput] = useState("Available now");
  const [profileAvatarFile, setProfileAvatarFile] = useState(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activeRoomSlug, setActiveRoomSlug] = useState("general");
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [messageInput, setMessageInput] = useState("");
  const [error, setError] = useState("");
  const [typingName, setTypingName] = useState("");
  const [recordingName, setRecordingName] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [listenedMap, setListenedMap] = useState(loadPlayedMap);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [chatEmojiPicker, setChatEmojiPicker] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [globalMessageResults, setGlobalMessageResults] = useState([]);
  const [globalMessageSearchLoading, setGlobalMessageSearchLoading] = useState(false);
  const [globalMessageSearchError, setGlobalMessageSearchError] = useState("");
  const [highlightedSearchMessageId, setHighlightedSearchMessageId] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sidebarMode, setSidebarMode] = useState("chats");
  const [chatPrefs, setChatPrefs] = useState(loadChatPrefs);
  const [roomContextMenu, setRoomContextMenu] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [voicePreviewBlob, setVoicePreviewBlob] = useState(null);
  const [isSendingVoicePreview, setIsSendingVoicePreview] = useState(false);

  // WebRTC voice call state
  const [inCall, setInCall] = useState(false);
  const [callParticipants, setCallParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [callError, setCallError] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callRoomSlug, setCallRoomSlug] = useState("");
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({});
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState({});
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState("idle");
  const [activeCallType, setActiveCallType] = useState("audio");
  const [callHistory, setCallHistory] = useState([]);
  const [floatingCallPosition, setFloatingCallPosition] = useState(null);
  const [callControlsVisible, setCallControlsVisible] = useState(true);
  const [callConnectionState, setCallConnectionState] = useState("idle");
  const [cameraFacingMode, setCameraFacingMode] = useState("user");
  const [localVideoVersion, setLocalVideoVersion] = useState(0);

  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const messageListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const roomLongPressTimerRef = useRef(null);
  const skipRoomClickRef = useRef(false);

  const mediaRecorderRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const voicePreviewBlobRef = useRef(null);

  const localCallStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteAudioElsRef = useRef({});
  const screenShareStreamRef = useRef(null);
  const floatingDragRef = useRef(null);
  const screenShareTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const isSwitchingCameraRef = useRef(false);
  const inCallRef = useRef(false);
  const activeRoomSlugRef = useRef(activeRoomSlug);
  const callRoomSlugRef = useRef("");
  const activeCallTypeRef = useRef("audio");
  const callControlsTimerRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const incomingRingtoneAudioRef = useRef(null);
  const outgoingRingIntervalRef = useRef(null);
  const ringtoneAudioContextRef = useRef(null);
  const makingOfferRef = useRef({});
  const ignoredOfferRef = useRef({});
  const reconnectTimersRef = useRef({});

  const currentProfileId = profile?.profileId || profile?._id;
  const canChat = Boolean(profile?.nameLocked && profile?.displayName);


  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/notification-sw.js").catch((err) => {
      console.warn("Notification service worker registration failed:", err);
    });
  }, []);

  function getAudioContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    const ctx = ringtoneAudioContextRef.current || new AudioContextCtor();
    ringtoneAudioContextRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume?.();
    return ctx;
  }

  function playIncomingVintageRingPulse() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const start = ctx.currentTime;
      const makeBurst = (offset) => {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.34, start + offset + 0.035);
        gain.gain.setValueAtTime(0.34, start + offset + 0.42);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.52);
        gain.connect(ctx.destination);
        [425, 475].forEach((frequency) => {
          const oscillator = ctx.createOscillator();
          oscillator.type = "triangle";
          oscillator.frequency.setValueAtTime(frequency, start + offset);
          oscillator.connect(gain);
          oscillator.start(start + offset);
          oscillator.stop(start + offset + 0.54);
        });
      };
      makeBurst(0);
      makeBurst(0.72);
    } catch (_) {}
  }

  function playOutgoingRingPulse() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const start = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.04);
      gain.gain.setValueAtTime(0.16, start + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.82);
      gain.connect(ctx.destination);
      [440, 480].forEach((frequency) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.connect(gain);
        oscillator.start(start);
        oscillator.stop(start + 0.84);
      });
    } catch (_) {}
  }

  function startIncomingRingtone() {
    if (incomingRingtoneAudioRef.current || ringtoneIntervalRef.current) return;

    const audio = new Audio("/notifications/Landline.mp3");
    audio.loop = true;
    audio.volume = 0.9;
    incomingRingtoneAudioRef.current = audio;

    audio.play().catch((error) => {
      console.warn("Incoming ringtone file could not autoplay; using fallback ring pulse.", error);
      incomingRingtoneAudioRef.current = null;
      playIncomingVintageRingPulse();
      ringtoneIntervalRef.current = window.setInterval(playIncomingVintageRingPulse, 3000);
    });
  }

  function stopIncomingRingtone() {
    if (incomingRingtoneAudioRef.current) {
      incomingRingtoneAudioRef.current.pause();
      incomingRingtoneAudioRef.current.currentTime = 0;
      incomingRingtoneAudioRef.current = null;
    }

    if (ringtoneIntervalRef.current) {
      window.clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  }

  function startOutgoingRingtone() {
    if (outgoingRingIntervalRef.current) return;
    playOutgoingRingPulse();
    outgoingRingIntervalRef.current = window.setInterval(playOutgoingRingPulse, 3000);
  }

  function stopOutgoingRingtone() {
    if (outgoingRingIntervalRef.current) {
      window.clearInterval(outgoingRingIntervalRef.current);
      outgoingRingIntervalRef.current = null;
    }
  }


  async function requestBrowserNotifications() {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return "unsupported";
    }
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") {
      alert("Notifications are blocked for this app. Enable them from your browser or app settings.");
      return "denied";
    }
    return Notification.requestPermission();
  }

  function showLocalNotification({ title, body, tag, onClick }) {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const notification = new Notification(title, {
        body,
        tag,
        renotify: true,
        silent: false,
        icon: "/vite.svg",
      });
      notification.onclick = () => {
        window.focus();
        if (typeof onClick === "function") onClick();
        notification.close();
      };
    } catch (err) {
      console.warn("Notification error:", err);
    }
  }

  function shouldNotifyNow(roomSlug = "") {
    return document.hidden || !document.hasFocus() || (roomSlug && roomSlug !== activeRoomSlugRef.current);
  }

  function notifyIncomingCall(payload = {}) {
    if (!payload.roomSlug || !shouldNotifyNow(payload.roomSlug)) return;
    const isGeneral = payload.roomSlug === "general";
    const callerName = payload.name || payload.callerName || "Someone";
    const title = isGeneral ? "General call" : `${callerName} is calling`;
    const typeLabel = payload.type === "video" ? "Video call" : "Audio call";
    showLocalNotification({
      title,
      body: isGeneral ? `${callerName} started a ${typeLabel.toLowerCase()}` : typeLabel,
      tag: `incoming-call-${payload.roomSlug}`,
      onClick: () => {
        setSidebarMode("chats");
        setActiveRoomSlug(payload.roomSlug);
      },
    });
  }

  function notifyNewMessage(message = {}) {
    if (!message.roomSlug) return;
    if (!shouldNotifyNow(message.roomSlug)) return;
    if (String(message.senderProfileId || "") === String(currentProfileId || "")) return;
    const room = roomsSorted.find((item) => item.slug === message.roomSlug);
    const chatName = room
      ? getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)
      : message.roomSlug === "general"
        ? "General"
        : "New message";
    const body = message.type === "audio"
      ? `${message.sender || "Someone"}: Voice note`
      : message.type === "file"
        ? `${message.sender || "Someone"}: ${message.fileName || "Attachment"}`
        : `${message.sender || "Someone"}: ${message.content || "New message"}`;
    showLocalNotification({
      title: chatName,
      body,
      tag: `message-${message.roomSlug}`,
      onClick: () => {
        setSidebarMode("chats");
        setActiveRoomSlug(message.roomSlug);
      },
    });
  }

  function openGlobalSearchResult(result) {
    if (!result?.roomSlug) return;
    setSidebarMode("chats");
    setActiveRoomSlug(result.roomSlug);
    setShowChatDetails(false);
    setShowSidebar(false);
    setMessageSearch("");
    setShowMessageSearch(false);
    setHighlightedSearchMessageId(result._id || "");
  }

  function updateChatPref(name, value) {
    setChatPrefs((current) => {
      const next = { ...current, [name]: value };
      saveChatPrefs(next);
      return next;
    });
  }

  const roomsSorted = useMemo(() => {
    if (!rooms.length) return [];

    return [...rooms].sort((a, b) => {
      const aUnread = unreadCounts[a.slug] || 0;
      const bUnread = unreadCounts[b.slug] || 0;

      if (bUnread !== aUnread) return bUnread - aUnread;

      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [rooms, unreadCounts]);

  const activeRoom = useMemo(
    () => roomsSorted.find((room) => room.slug === activeRoomSlug) || null,
    [roomsSorted, activeRoomSlug]
  );

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCounts || {}).reduce((total, count) => total + Number(count || 0), 0),
    [unreadCounts]
  );

  const filteredRooms = useMemo(
    () =>
      roomsSorted.filter((room) =>
        getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)
          .toLowerCase()
          .includes(chatSearch.toLowerCase())
      ),
    [roomsSorted, chatSearch, profile?.displayName]
  );

  const filteredProfiles = useMemo(
    () =>
      profiles.filter((user) =>
        user.displayName.toLowerCase().includes(chatSearch.toLowerCase())
      ),
    [profiles, chatSearch]
  );

  const rawMessages = messagesByRoom[activeRoomSlug] || [];

  const activePinnedMessages = useMemo(
    () => rawMessages.filter((message) => !message.isDeleted && message.pinned),
    [rawMessages]
  );

  const activeStarredCount = useMemo(
    () => rawMessages.filter((message) => Array.isArray(message.starredBy) && message.starredBy.some((id) => String(id) === String(currentProfileId || ""))).length,
    [rawMessages, currentProfileId]
  );

  const activeRoomMedia = useMemo(
    () => rawMessages.filter((message) => !message.isDeleted && (message.type === "file" || message.type === "audio" || message.fileUrl)),
    [rawMessages]
  );

  const activeRoomOtherProfile = useMemo(() => {
    if (!activeRoom?.isDirect) return null;
    const otherProfileId = (activeRoom.participants || [])
      .map((id) => String(id))
      .find((id) => id && id !== String(currentProfileId || ""));
    return profiles.find((user) => String(user._id) === String(otherProfileId)) || null;
  }, [activeRoom, profiles, currentProfileId]);

  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return rawMessages;
    const q = messageSearch.toLowerCase();

    return rawMessages.filter((message) => {
      const haystack = [
        message.content,
        message.fileName,
        message.sender,
        message.replyTo?.content,
        message.replyTo?.fileName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rawMessages, messageSearch]);

  const groupedMessages = useMemo(() => groupMessagesByDay(filteredMessages), [filteredMessages]);

  const pendingUploadsForRoom = pendingUploads.filter((item) => item.roomSlug === activeRoomSlug);
  const isGroupChat = activeRoom ? activeRoom.slug === "general" : true;
  const activeRoomHasCall = Boolean(activeRoom?.activeCall);
  const currentCallRoomSlug = callRoomSlug || activeRoomSlug;
  const currentCallRoom = roomsSorted.find((room) => room.slug === currentCallRoomSlug) || activeRoom;
  const currentCallIsDirect = Boolean(currentCallRoom && currentCallRoom.slug !== "general");
  const currentCallTitle = currentCallIsDirect
    ? getRoomDisplayName(currentCallRoom, profile?.displayName, currentProfileId, profiles)
    : getRoomDisplayName(currentCallRoom, profile?.displayName, currentProfileId, profiles);
  function getProfileNameById(profileId, fallback = "User") {
    if (String(profileId || "") === String(currentProfileId || "")) {
      return profile?.displayName || "Me";
    }

    const found = profiles.find((user) => String(user._id) === String(profileId || ""));
    return found?.displayName || fallback || "User";
  }

  function getProfileAvatarById(profileId) {
    if (String(profileId || "") === String(currentProfileId || "")) {
      return profile?.avatarUrl || "";
    }
    const found = profiles.find((user) => String(user._id) === String(profileId || ""));
    return found?.avatarUrl || "";
  }

  function getRoomAvatarSrc(room) {
    if (!room || room.slug === "general") return "";
    const otherProfileId = (room.participants || []).find((id) => String(id) !== String(currentProfileId || ""));
    return getProfileAvatarById(otherProfileId);
  }

  const visibleCallParticipants = (callParticipants.length
    ? callParticipants
    : [{ profileId: currentProfileId, name: profile?.displayName || "You" }]
  ).map((participant) => {
    const isMe =
      String(participant.profileId || "") === String(currentProfileId || "") ||
      String(participant.name || "") === String(profile?.displayName || "");

    return {
      ...participant,
      displayName: isMe ? "Me" : getProfileNameById(participant.profileId, participant.name || "User"),
    };
  });

  function getCallParticipantDisplayName(peerSocketId) {
    const participant = callParticipants.find((item) => item.socketId === peerSocketId);
    if (!participant) return "Participant";

    const isMe =
      String(participant.profileId || "") === String(currentProfileId || "") ||
      String(participant.name || "") === String(profile?.displayName || "");

    return isMe ? "Me" : getProfileNameById(participant.profileId, participant.name || "Participant");
  }

  function getCallHistoryDisplayName(call) {
    const room = roomsSorted.find((item) => item.slug === call.roomSlug);
    if (call.roomSlug === "general") return "General";
    if (call.otherUserName && String(call.otherUserName).toLowerCase() !== "general") return call.otherUserName;
    if (room && room.slug !== "general") return getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles);
    if (call.isDirect && call.title) {
      const currentName = (profile?.displayName || "").trim();
      const parts = String(call.title)
        .split(/\s*&\s*|\s+and\s+/i)
        .map((part) => part.trim())
        .filter(Boolean);
      const other = parts.find((part) => part.toLowerCase() !== currentName.toLowerCase());
      if (other) return other;
      if (call.callerName && call.callerName !== currentName) return call.callerName;
    }
    return call.roomName || call.title || getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles) || call.roomSlug;
  }

  function getCallHistoryTypeLabel(call) {
    return (call.callType || call.type) === "video" ? "📹 Video call" : "📞 Audio call";
  }

  async function startCallFromHistory(call) {
    if (!call?.roomSlug) return;
    const nextType = (call.callType || call.type) === "video" ? "video" : "audio";
    if (call.roomSlug !== activeRoomSlugRef.current) {
      setActiveRoomSlug(call.roomSlug);
    }
    await enterCall("call:start", call.roomSlug, nextType);
    if (nextType === "video") {
      window.setTimeout(() => {
        if (!cameraTrackRef.current) startCamera();
        setIsCallMinimized(false);
      }, 250);
    }
  }

  function revealCallControls() {
    setCallControlsVisible(true);
    if (callControlsTimerRef.current) clearTimeout(callControlsTimerRef.current);
    callControlsTimerRef.current = setTimeout(() => {
      setCallControlsVisible(false);
    }, 2400);
  }

  const minimizedRemoteVideoEntry = Object.entries(remoteScreenStreams).find(([socketId]) => remoteVideoEnabled[socketId] !== false) || null;
  const visibleRemoteVideoEntries = Object.entries(remoteScreenStreams).filter(([socketId]) => remoteVideoEnabled[socketId] !== false);
  const hasVisibleVideo = Boolean(localVideoStream || visibleRemoteVideoEntries.length);

  function emitLocalVideoState(enabled) {
    const targetRoomSlug = callRoomSlugRef.current || activeRoomSlugRef.current;
    if (!targetRoomSlug) return;
    socket.emit("call:media-state", {
      roomSlug: targetRoomSlug,
      profileId: currentProfileId,
      name: profile?.displayName || "User",
      videoEnabled: Boolean(enabled),
    });
  }

  useEffect(() => {
    savePlayedMap(listenedMap);
  }, [listenedMap]);

  useEffect(() => {
    if (!reactionPicker && !chatEmojiPicker) return;

    const close = () => {
      setReactionPicker(null);
      setChatEmojiPicker(null);
    };

    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [reactionPicker, chatEmojiPicker]);

  useEffect(() => {
    if (!activeRoomSlug) return;
    setUnreadCounts((current) => ({ ...current, [activeRoomSlug]: 0 }));
  }, [activeRoomSlug]);

  useEffect(() => {
    if (!isCallMinimized) {
      floatingDragRef.current = null;
      return;
    }

    const onPointerMove = (event) => {
      const drag = floatingDragRef.current;
      if (!drag) return;

      event.preventDefault?.();
      const width = drag.width || 320;
      const height = drag.height || 170;
      const margin = 8;
      const nextX = Math.min(
        Math.max(margin, event.clientX - drag.offsetX),
        Math.max(margin, window.innerWidth - width - margin)
      );
      const nextY = Math.min(
        Math.max(margin, event.clientY - drag.offsetY),
        Math.max(margin, window.innerHeight - height - margin)
      );

      setFloatingCallPosition({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      floatingDragRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isCallMinimized]);

  function startFloatingCallDrag(event) {
    if (event.target?.closest?.("button, input, textarea, select, a")) return;

    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    floatingDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    setFloatingCallPosition({ x: rect.left, y: rect.top });
  }

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API_BASE}/api/session/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-install-id": installId,
          },
          body: JSON.stringify({ installId }),
        });

        const payload = await res.json();
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "Failed to initialize session");
        }

        setSession(payload.data);
        setProfile(payload.data);
        setDisplayNameInput(payload.data.displayName || "");
        setProfileStatusInput(payload.data.profileStatus || "Available now");
      } catch (err) {
        setError(err.message || "Failed to initialize session");
      }
    }

    init();
  }, [installId]);


  useEffect(() => {
    if (!canChat || !installId) return;

    socket.emit("profile:register", {
      installId,
      profileId: currentProfileId || profile?.profileId || null,
    });
  }, [canChat, installId, currentProfileId, profile?.profileId]);

  useEffect(() => {
    if (!canChat) return;

    async function loadRoomsAndProfiles() {
      try {
        const [roomsRes, profilesRes, unreadRes] = await Promise.all([
          fetch(`${API_BASE}/api/rooms`, { headers: { "x-install-id": installId } }),
          fetch(`${API_BASE}/api/profiles`, { headers: { "x-install-id": installId } }),
          fetch(`${API_BASE}/api/unread-counts`, { headers: { "x-install-id": installId } }),
        ]);

        const [roomsPayload, profilesPayload, unreadPayload] = await Promise.all([
          roomsRes.json(),
          profilesRes.json(),
          unreadRes.json(),
        ]);

        setRooms(Array.isArray(roomsPayload) ? roomsPayload : []);
        setProfiles(Array.isArray(profilesPayload) ? profilesPayload : []);
        if (unreadPayload && !unreadPayload.success) setUnreadCounts({});
        else setUnreadCounts(unreadPayload || {});
      } catch (err) {
        setError(err.message || "Failed to load data");
      }
    }

    loadRoomsAndProfiles();

    const onRoomsUpdated = () => loadRoomsAndProfiles();
    const onProfilesUpdated = () => loadRoomsAndProfiles();
    const onUnreadCountsUpdated = (counts) => {
      const normalizedCounts = {};
      Object.entries(counts || {}).forEach(([roomSlug, count]) => {
        normalizedCounts[roomSlug] = Number(count || 0);
      });
      setUnreadCounts(normalizedCounts);
    };

    socket.on("rooms_updated", onRoomsUpdated);
    socket.on("profiles_updated", onProfilesUpdated);
    socket.on("unread_counts_updated", onUnreadCountsUpdated);

    return () => {
      socket.off("rooms_updated", onRoomsUpdated);
      socket.off("profiles_updated", onProfilesUpdated);
      socket.off("unread_counts_updated", onUnreadCountsUpdated);
    };
  }, [canChat, installId]);


  useEffect(() => {
    if (!canChat || sidebarMode !== "chats") {
      setGlobalMessageResults([]);
      setGlobalMessageSearchError("");
      setGlobalMessageSearchLoading(false);
      return;
    }

    const q = chatSearch.trim();
    if (q.length < 2) {
      setGlobalMessageResults([]);
      setGlobalMessageSearchError("");
      setGlobalMessageSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setGlobalMessageSearchLoading(true);
        setGlobalMessageSearchError("");
        const res = await fetch(
          `${API_BASE}/api/messages/search?q=${encodeURIComponent(q)}&installId=${encodeURIComponent(installId)}`,
          { headers: { "x-install-id": installId }, signal: controller.signal }
        );
        const payload = await res.json();
        if (!res.ok || payload.success === false) {
          throw new Error(payload.error || "Failed to search messages");
        }
        setGlobalMessageResults(Array.isArray(payload.data) ? payload.data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setGlobalMessageSearchError(err.message || "Search failed");
          setGlobalMessageResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setGlobalMessageSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canChat, sidebarMode, chatSearch, installId]);

  useEffect(() => {
    if (!highlightedSearchMessageId || !activeRoomSlug) return;
    const currentMessages = messagesByRoom[activeRoomSlug] || [];
    const hasMessage = currentMessages.some((message) => String(message._id || "") === String(highlightedSearchMessageId));
    if (!hasMessage) return;

    const timer = window.setTimeout(() => {
      const node = document.querySelector(`[data-message-id="${CSS.escape(String(highlightedSearchMessageId))}"]`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => setHighlightedSearchMessageId(""), 2200);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [highlightedSearchMessageId, activeRoomSlug, messagesByRoom]);

  useEffect(() => {
    if (!canChat || !activeRoomSlug) return;

    socket.emit("join_room", { roomSlug: activeRoomSlug, installId });

    const handleLoadMessages = (incoming) => {
      setMessagesByRoom((current) => ({
        ...current,
        [activeRoomSlug]: (incoming || []).map((msg) => ({ ...msg, reactions: normalizeReactions(msg.reactions) })),
      }));
      if (!document.hidden && document.hasFocus()) {
        socket.emit("mark_seen", { roomSlug: activeRoomSlug, installId });
        setUnreadCounts((current) => ({ ...current, [activeRoomSlug]: 0 }));
      }
    };

    const handleReceiveMessage = (message) => {
      if (!message?.roomSlug) return;
      const displayMessage = { ...message, reactions: normalizeReactions(message.reactions) };

      setMessagesByRoom((current) => {
        const roomMessages = current[displayMessage.roomSlug] || [];
        const exists = roomMessages.some((item) => String(item._id) === String(displayMessage._id));
        if (exists) return current;

        return {
          ...current,
          [displayMessage.roomSlug]: [
            ...roomMessages,
            displayMessage,
          ],
        };
      });

      const isOwnMessage =
        String(displayMessage.senderProfileId || "") === String(currentProfileId || "");
      const isActiveRoom = displayMessage.roomSlug === activeRoomSlug;
      const canMarkSeenNow = isActiveRoom && !document.hidden && document.hasFocus();

      if (!isOwnMessage && !canMarkSeenNow) {
        setUnreadCounts((current) => ({
          ...current,
          [displayMessage.roomSlug]: (current[displayMessage.roomSlug] || 0) + 1,
        }));
      }

      notifyNewMessage(displayMessage);

      if (canMarkSeenNow) {
        socket.emit("mark_seen", { roomSlug: activeRoomSlug, installId });
        setUnreadCounts((current) => ({ ...current, [activeRoomSlug]: 0 }));
      }
    };

    const handleDeletedMessage = ({ roomSlug, messageId, message }) => {
      setMessagesByRoom((current) => {
        const roomMessages = current[roomSlug] || [];
        return {
          ...current,
          [roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(messageId)
              ? { ...item, ...message, content: message.isDeleted ? message.content : item.content, encryptedContent: item.encryptedContent, isEncrypted: item.isEncrypted, reactions: normalizeReactions(message.reactions) }
              : item
          ),
        };
      });
    };

    const handleStatusesUpdated = ({ roomSlug, messages: updated }) => {
      setMessagesByRoom((current) => {
        const roomMessages = current[roomSlug] || [];
        if (!roomMessages.length) return current;

        const updatesMap = new Map(updated.map((item) => [String(item._id), item]));
        return {
          ...current,
          [roomSlug]: roomMessages.map((item) =>
            updatesMap.has(String(item._id))
              ? {
                  ...item,
                  ...updatesMap.get(String(item._id)),
                  reactions: normalizeReactions(updatesMap.get(String(item._id)).reactions),
                }
              : item
          ),
        };
      });

      if (roomSlug === activeRoomSlug && !document.hidden && document.hasFocus()) {
        setUnreadCounts((current) => ({ ...current, [activeRoomSlug]: 0 }));
      }
    };

    const handleReactionUpdated = ({ roomSlug, message }) => {
      setMessagesByRoom((current) => {
        const roomMessages = current[roomSlug] || [];
        return {
          ...current,
          [roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(message._id)
              ? { ...item, ...message, reactions: normalizeReactions(message.reactions) }
              : item
          ),
        };
      });
    };

    const handleFlagsUpdated = ({ roomSlug, message }) => {
      setMessagesByRoom((current) => {
        const roomMessages = current[roomSlug] || [];
        return {
          ...current,
          [roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(message._id)
              ? { ...item, ...message, reactions: normalizeReactions(message.reactions) }
              : item
          ),
        };
      });
    };

    const handleChatHistoryDeleted = ({ roomSlug }) => {
      if (!roomSlug) return;
      setMessagesByRoom((current) => ({ ...current, [roomSlug]: [] }));
      setUnreadCounts((current) => ({ ...current, [roomSlug]: 0 }));
      if (roomSlug === activeRoomSlug) {
        setReplyTo(null);
        setReactionPicker(null);
        setForwardPickerMessage(null);
      }
    };

    const handleChatHidden = ({ roomSlug }) => {
      if (!roomSlug) return;
      setMessagesByRoom((current) => ({ ...current, [roomSlug]: [] }));
      setUnreadCounts((current) => ({ ...current, [roomSlug]: 0 }));
      setRooms((current) => current.filter((room) => room.slug !== roomSlug));
      if (roomSlug === activeRoomSlug) {
        const nextRoom = roomsSorted.find((room) => room.slug !== roomSlug);
        setActiveRoomSlug(nextRoom?.slug || "general");
        setShowChatDetails(false);
      }
    };

    const handleUserTyping = (name) => setTypingName(name || "");
    const handleUserStopTyping = () => setTypingName("");
    const handleUserRecordingAudio = (payload) => {
      const payloadRoomSlug =
        typeof payload === "object" && payload !== null ? payload.roomSlug : activeRoomSlug;
      const payloadProfileId =
        typeof payload === "object" && payload !== null ? String(payload.profileId || "") : "";
      const payloadName =
        typeof payload === "object" && payload !== null ? payload.name : payload;

      if (payloadRoomSlug !== activeRoomSlug) return;
      if (payloadProfileId && payloadProfileId === String(currentProfileId || "")) return;

      setRecordingName(payloadName || "Someone");
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = window.setTimeout(() => setRecordingName(""), 5000);
    };
    const handleUserStopRecordingAudio = (payload) => {
      const payloadRoomSlug =
        typeof payload === "object" && payload !== null ? payload.roomSlug : activeRoomSlug;
      const payloadProfileId =
        typeof payload === "object" && payload !== null ? String(payload.profileId || "") : "";

      if (payloadRoomSlug !== activeRoomSlug) return;
      if (payloadProfileId && payloadProfileId === String(currentProfileId || "")) return;

      window.clearTimeout(recordingTimeoutRef.current);
      setRecordingName("");
    };

    socket.on("load_messages", handleLoadMessages);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_deleted", handleDeletedMessage);
    socket.on("messages_status_updated", handleStatusesUpdated);
    socket.on("message_reaction_updated", handleReactionUpdated);
    socket.on("message_flags_updated", handleFlagsUpdated);
    socket.on("chat_history_deleted", handleChatHistoryDeleted);
    socket.on("chat_hidden", handleChatHidden);
    socket.on("chat_deleted", handleChatHidden);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);
    socket.on("user_recording_audio", handleUserRecordingAudio);
    socket.on("user_stop_recording_audio", handleUserStopRecordingAudio);

    return () => {
      socket.emit("leave_room", { roomSlug: activeRoomSlug });
      socket.off("load_messages", handleLoadMessages);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_deleted", handleDeletedMessage);
      socket.off("messages_status_updated", handleStatusesUpdated);
      socket.off("message_reaction_updated", handleReactionUpdated);
      socket.off("message_flags_updated", handleFlagsUpdated);
      socket.off("chat_history_deleted", handleChatHistoryDeleted);
      socket.off("chat_hidden", handleChatHidden);
      socket.off("chat_deleted", handleChatHidden);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      socket.off("user_recording_audio", handleUserRecordingAudio);
      socket.off("user_stop_recording_audio", handleUserStopRecordingAudio);
      window.clearTimeout(recordingTimeoutRef.current);
    };
  }, [activeRoomSlug, canChat, installId, currentProfileId]);

  useEffect(() => {
    if (!canChat || !activeRoomSlug || !installId) return;

    const markActiveRoomSeenIfVisible = () => {
      if (document.hidden || !document.hasFocus()) return;
      socket.emit("mark_seen", { roomSlug: activeRoomSlug, installId });
      setUnreadCounts((current) => ({ ...current, [activeRoomSlug]: 0 }));
    };

    window.addEventListener("focus", markActiveRoomSeenIfVisible);
    document.addEventListener("visibilitychange", markActiveRoomSeenIfVisible);

    return () => {
      window.removeEventListener("focus", markActiveRoomSeenIfVisible);
      document.removeEventListener("visibilitychange", markActiveRoomSeenIfVisible);
    };
  }, [activeRoomSlug, canChat, installId, currentProfileId]);

  useEffect(() => {
    const handleParticipants = ({ participants, roomSlug }) => {
      if (roomSlug && callRoomSlugRef.current && roomSlug !== callRoomSlugRef.current) return;
      if (roomSlug && !callRoomSlugRef.current && roomSlug !== activeRoomSlugRef.current) return;
      setCallParticipants(Array.isArray(participants) ? participants : []);
    };

    socket.on("call:participants", handleParticipants);

    return () => {
      socket.off("call:participants", handleParticipants);
    };
  }, [activeRoomSlug]);

  useEffect(() => {
    const handleCallState = ({ roomSlug, active, participants }) => {
      if (!roomSlug) return;

      setRooms((current) =>
        current.map((room) =>
          room.slug === roomSlug
            ? {
                ...room,
                activeCall: Boolean(active),
                activeCallParticipants: Array.isArray(participants) ? participants : [],
              }
            : room
        )
      );

      if (roomSlug === (callRoomSlugRef.current || activeRoomSlugRef.current)) {
        setCallParticipants(Array.isArray(participants) ? participants : []);
      }
    };

    const handleIncomingCall = (payload = {}) => {
      if (!payload.roomSlug) return;
      if (inCallRef.current) return;
      if (String(payload.profileId || "") === String(currentProfileId || "")) return;
      setIncomingCall(payload);
      notifyIncomingCall(payload);
    };

    socket.on("call:state", handleCallState);
    socket.on("call:incoming", handleIncomingCall);

    return () => {
      socket.off("call:state", handleCallState);
      socket.off("call:incoming", handleIncomingCall);
    };
  }, [currentProfileId]);

  useEffect(() => {
    if (incomingCall) startIncomingRingtone();
    else stopIncomingRingtone();
    return stopIncomingRingtone;
  }, [incomingCall]);

  useEffect(() => {
    if (inCall && callStatus === "ringing") startOutgoingRingtone();
    else stopOutgoingRingtone();
    return stopOutgoingRingtone;
  }, [inCall, callStatus]);

  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  useEffect(() => {
    activeCallTypeRef.current = activeCallType;
  }, [activeCallType]);

  useEffect(() => {
    if (!roomContextMenu) return;
    const close = () => closeRoomContextMenu();
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [roomContextMenu]);

  useEffect(() => {
    activeRoomSlugRef.current = activeRoomSlug;
  }, [activeRoomSlug]);

  useEffect(() => {
    callRoomSlugRef.current = callRoomSlug;
  }, [callRoomSlug]);

  useEffect(() => {
    if (!inCall || !callStartedAt || callStatus !== "connected") {
      setCallDuration(0);
      return;
    }
    const tick = () => setCallDuration(Math.floor((Date.now() - callStartedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [inCall, callStartedAt, callStatus]);

  useEffect(() => {
    if (!inCall) {
      setCallControlsVisible(true);
      return;
    }
    revealCallControls();
    return () => {
      if (callControlsTimerRef.current) clearTimeout(callControlsTimerRef.current);
    };
  }, [inCall, isCallMinimized]);

  useEffect(() => {
    const refreshCallHistory = async () => {
      if (!canChat) return;
      try {
        const res = await fetch(`${API_BASE}/api/calls?installId=${encodeURIComponent(installId)}`, { headers: { "x-install-id": installId } });
        if (res.ok) setCallHistory(await res.json());
      } catch {
        // ignore call-history refresh failures
      }
    };
    refreshCallHistory();
    socket.on("calls_updated", refreshCallHistory);
    return () => socket.off("calls_updated", refreshCallHistory);
  }, [canChat, installId]);

  useEffect(() => {
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") sender.track.enabled = !isMuted;
      });
    });

    localCallStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    const handleUserJoined = async ({ socketId } = {}) => {
      if (!socketId || !inCallRef.current || !localCallStreamRef.current) return;

      try {
        const pc = createPeerConnection(socketId);

        // Avoid duplicate offers. A second offer while the peer connection is not
        // stable is what later causes "setRemoteDescription(answer) called in
        // wrong state: stable".
        if (pc.signalingState !== "stable" || makingOfferRef.current[socketId]) {
          return;
        }

        makingOfferRef.current[socketId] = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:signal", {
          to: socketId,
          data: pc.localDescription,
        });
      } catch (err) {
        setCallError(err.message || "Failed to connect call audio/video.");
      } finally {
        makingOfferRef.current[socketId] = false;
      }
    };

    const handleSignal = async ({ from, data } = {}) => {
      if (!from || !data) return;

      try {
        if (!localCallStreamRef.current) {
          await startLocalCallStream();
          setInCall(true);
        }

        const pc = createPeerConnection(from);

        if (data.type === "offer") {
          const offerCollision =
            makingOfferRef.current[from] || pc.signalingState !== "stable";

          ignoredOfferRef.current[from] = false;

          if (offerCollision) {
            // Glare handling: if both users create an offer, roll back our local
            // offer and accept the incoming offer instead.
            try {
              await pc.setLocalDescription({ type: "rollback" });
            } catch {
              ignoredOfferRef.current[from] = true;
              return;
            }
          }

          const appliedOffer = await safeSetRemoteDescription(pc, data, { label: "offer" });
          if (!appliedOffer) return;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("call:signal", {
            to: from,
            data: pc.localDescription,
          });
          return;
        }

        if (data.type === "answer") {
          // Only apply an answer when we actually have a local offer waiting.
          // Duplicate/stale answers arrive after renegotiation or double-clicks;
          // applying them in "stable" causes the reported runtime error.
          if (pc.signalingState !== "have-local-offer") {
            console.warn("Ignoring stale WebRTC answer in state:", pc.signalingState);
            return;
          }

          const appliedAnswer = await safeSetRemoteDescription(pc, data, {
            label: "answer",
            requiredState: "have-local-offer",
          });
          if (!appliedAnswer) return;
          return;
        }

        if (data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
          } catch (err) {
            if (!ignoredOfferRef.current[from]) throw err;
          }
        }
      } catch (err) {
        setCallError(err.message || "Failed to handle call signal.");
      }
    };

    const handleMediaState = ({ socketId, videoEnabled } = {}) => {
      if (!socketId) return;
      setRemoteVideoEnabled((current) => ({
        ...current,
        [socketId]: Boolean(videoEnabled),
      }));
      if (!videoEnabled) {
        setRemoteScreenStreams((current) => {
          const next = { ...current };
          delete next[socketId];
          return next;
        });
      }
    };

    const handleUserLeft = ({ socketId } = {}) => {
      closePeerConnection(socketId);
    };

    const handleCallAccepted = ({ roomSlug, startedAt } = {}) => {
      if (roomSlug && callRoomSlugRef.current && roomSlug !== callRoomSlugRef.current) return;
      setCallStatus("connected");
      setCallStartedAt(startedAt ? new Date(startedAt).getTime() : Date.now());
    };

    const handleCallRejected = ({ roomSlug } = {}) => {
      if (roomSlug && callRoomSlugRef.current && roomSlug !== callRoomSlugRef.current) return;
      cleanupCallMedia();
      setInCall(false);
      setIsMuted(false);
      setIsCallMinimized(false);
      setCallRoomSlug("");
      setCallParticipants([]);
      setCallStartedAt(null);
      setCallStatus("rejected");
      setCallError("Call rejected");
      window.setTimeout(() => {
        setCallError("");
        setCallStatus("idle");
    setCallConnectionState("idle");
      }, 2500);
    };

    const handleCallEnded = ({ roomSlug, reason } = {}) => {
      setIncomingCall((current) => current?.roomSlug === roomSlug ? null : current);
      stopIncomingRingtone();
      if (roomSlug && callRoomSlugRef.current && roomSlug !== callRoomSlugRef.current) return;
      cleanupCallMedia();
      setInCall(false);
      setIsMuted(false);
      setIsCallMinimized(false);
      setCallRoomSlug("");
      setCallParticipants([]);
      setCallStartedAt(null);
      setCallStatus(reason === "rejected" ? "rejected" : "idle");
      if (reason === "rejected") {
        setCallError("Call rejected");
        window.setTimeout(() => {
          setCallError("");
          setCallStatus("idle");
        }, 2500);
      }
    };

    socket.on("call:user-joined", handleUserJoined);
    socket.on("call:signal", handleSignal);
    socket.on("call:user-left", handleUserLeft);
    socket.on("call:media-state", handleMediaState);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:ended", handleCallEnded);

    return () => {
      socket.off("call:user-joined", handleUserJoined);
      socket.off("call:signal", handleSignal);
      socket.off("call:user-left", handleUserLeft);
      socket.off("call:media-state", handleMediaState);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:ended", handleCallEnded);
    };
  }, []);

  useEffect(() => {
    const listEl = messageListRef.current;
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }, [groupedMessages, pendingUploadsForRoom.length, typingName]);

  function markPlayed(messageId) {
    setListenedMap((current) => {
      if (current[messageId]) return current;
      return { ...current, [messageId]: true };
    });
  }

  async function handleSetName() {
    try {
      setError("");
      const formData = new FormData();
      formData.append("installId", installId);
      formData.append("displayName", displayNameInput.trim());
      formData.append("profileStatus", profileStatusInput.trim() || "Available now");
      if (profileAvatarFile) formData.append("avatar", profileAvatarFile);

      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "POST",
        headers: { "x-install-id": installId },
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to save profile");
      }

      setSession(payload.data);
      setProfile(payload.data);
      setProfileAvatarFile(null);
      setProfileAvatarPreview("");
      setShowProfileEditor(false);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    }
  }

  async function startDirectRoom(targetProfileId) {
    try {
      setError("");
      const res = await fetch(`${API_BASE}/api/direct-room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-install-id": installId,
        },
        body: JSON.stringify({ targetProfileId }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create direct room");
      }

      const room = payload.data;
      setRooms((current) => {
        const exists = current.some((item) => item.slug === room.slug);
        return exists
          ? current.map((item) => (item.slug === room.slug ? room : item))
          : [room, ...current];
      });
      setActiveRoomSlug(room.slug);
      setReplyTo(null);
      setShowSidebar(false);
      setSidebarMode("chats");
    } catch (err) {
      setError(err.message || "Failed to create direct room");
    }
  }

  async function deleteMessage(messageId) {
    try {
      setError("");
      const res = await fetch(`${API_BASE}/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { "x-install-id": installId },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete message");
      }
    } catch (err) {
      setError(err.message || "Failed to delete message");
    }
  }

  function openRoomContextMenu(room, event) {
    if (!room) return;
    const point = event?.touches?.[0] || event?.changedTouches?.[0] || event;
    const x = Math.min(point?.clientX || 20, window.innerWidth - 220);
    const y = Math.min(point?.clientY || 20, window.innerHeight - 120);
    setRoomContextMenu({ roomSlug: room.slug, x: Math.max(8, x), y: Math.max(8, y) });
  }

  function closeRoomContextMenu() {
    setRoomContextMenu(null);
    if (roomLongPressTimerRef.current) {
      window.clearTimeout(roomLongPressTimerRef.current);
      roomLongPressTimerRef.current = null;
    }
  }

  async function clearChatHistory(roomSlugOverride = activeRoomSlug) {
    const targetRoomSlug = roomSlugOverride || activeRoomSlug;
    if (!targetRoomSlug) return;
    const targetRoom = roomsSorted.find((room) => room.slug === targetRoomSlug) || activeRoom;
    const roomName = getRoomDisplayName(targetRoom, profile?.displayName, currentProfileId, profiles) || "this chat";
    const confirmed = window.confirm(`Clear chat history in ${roomName} for you only? Other users will still keep their messages.`);
    if (!confirmed) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(targetRoomSlug)}/messages`, {
        method: "DELETE",
        headers: { "x-install-id": installId },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete chat history");
      }

      setMessagesByRoom((current) => ({ ...current, [targetRoomSlug]: [] }));
      setUnreadCounts((current) => ({ ...current, [targetRoomSlug]: 0 }));
      setReplyTo(null);
      setReactionPicker(null);
      setForwardPickerMessage(null);
    } catch (err) {
      setError(err.message || "Failed to delete chat history");
    }
  }


  async function exportChat(format = "txt", roomSlugOverride = activeRoomSlug) {
    const targetRoomSlug = roomSlugOverride || activeRoomSlug;
    if (!targetRoomSlug || !installId) return;

    try {
      setError("");
      const res = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(targetRoomSlug)}/export?format=${encodeURIComponent(format)}`,
        { headers: { "x-install-id": installId } }
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to export chat");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fallbackExt = format === "json" ? "json" : "txt";
      const fallbackName = `chat-export-${targetRoomSlug.replace(/[^a-zA-Z0-9_-]+/g, "_")}.${fallbackExt}`;
      const filename = match?.[1] || fallbackName;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to export chat");
    }
  }

  async function reactToMessage(messageId, emoji) {
    try {
      setError("");
      const res = await fetch(`${API_BASE}/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-install-id": installId,
        },
        body: JSON.stringify({ emoji }),
      });

      const payload = await res.json();

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to react to message");
      }

      const updatedMessage = payload.data;

      setMessagesByRoom((current) => {
        const roomMessages = current[updatedMessage.roomSlug] || [];
        return {
          ...current,
          [updatedMessage.roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(updatedMessage._id)
              ? { ...updatedMessage, reactions: normalizeReactions(updatedMessage.reactions) }
              : item
          ),
        };
      });

      setReactionPicker(null);
    } catch (err) {
      setError(err.message || "Failed to react to message");
    }
  }

  async function hideChatForMe(roomSlug = activeRoomSlug) {
    if (!roomSlug) return;
    const confirmed = window.confirm("Delete this chat from your chat list? This only affects your account.");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomSlug)}/hide`, {
        method: "DELETE",
        headers: { "x-install-id": installId },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.error || "Failed to delete chat");
      }

      setMessagesByRoom((current) => ({ ...current, [roomSlug]: [] }));
      setUnreadCounts((current) => ({ ...current, [roomSlug]: 0 }));
      setRooms((current) => current.filter((item) => item.slug !== roomSlug));
      if (roomSlug === activeRoomSlug) {
        const nextRoom = roomsSorted.find((item) => item.slug !== roomSlug);
        setActiveRoomSlug(nextRoom?.slug || "general");
        setShowChatDetails(false);
      }
    } catch (err) {
      setError(err.message || "Failed to delete chat");
    }
  }

  function updatePendingUpload(tempId, updates) {
    setPendingUploads((current) =>
      current.map((item) => (item.tempId === tempId ? { ...item, ...updates } : item))
    );
  }

  function removePendingUpload(tempId) {
    setPendingUploads((current) => current.filter((item) => item.tempId !== tempId));
  }

  function createPendingUpload(file, type = "file") {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previewUrl = file.type?.startsWith("image/") ? URL.createObjectURL(file) : "";

    const pendingItem = {
      tempId,
      roomSlug: activeRoomSlug,
      sender: profile?.displayName || "You",
      senderProfileId: profile?.profileId,
      createdAt: new Date().toISOString(),
      type,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      content: file.name,
      previewUrl,
      progress: 0,
      status: "queued",
    };

    setPendingUploads((current) => [...current, pendingItem]);
    return pendingItem;
  }

  function pendingTypeFromFile(file) {
    if (file?.type?.startsWith("audio/")) return "audio";
    return "file";
  }

  function handleFileSelect(fileList) {
    const files = Array.from(fileList || []);
    const MAX_FILE_SIZE_MB = 1024;
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

    files.forEach((file) => {
      if (file.size > maxBytes) {
        setError(`"${file.name}" is too large. Max allowed size is ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }
      uploadFile(file);
    });
  }

  async function uploadFile(file, options = {}) {
    if (!file) {
      setError("No file selected.");
      return;
    }

    if (!activeRoomSlug) {
      setError("Open a chat before uploading a file.");
      return;
    }

    if (!profile?.displayName) {
      setError("Your profile is not ready yet. Please refresh and try again.");
      return;
    }

    const MAX_FILE_SIZE_MB = 1024;
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

    if (file.size > maxBytes) {
      setError(`File is too large. Max allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    const pendingType = options.pendingType || pendingTypeFromFile(file);
    const pendingItem = createPendingUpload(file, pendingType);

    updatePendingUpload(pendingItem.tempId, { status: "processing", progress: 1 });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("roomSlug", activeRoomSlug);
    formData.append("installId", installId);
    formData.append("originalKind", pendingType);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload`);
        xhr.setRequestHeader("x-install-id", installId);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          updatePendingUpload(pendingItem.tempId, {
            status: "uploading",
            progress: Math.round((event.loaded / event.total) * 100),
          });
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            updatePendingUpload(pendingItem.tempId, {
              status: "processing",
              progress: 100,
            });
            resolve();
            return;
          }

          let payload = null;
          try {
            payload = JSON.parse(xhr.responseText || "null");
          } catch {
            payload = null;
          }

          reject(new Error(payload?.error || payload?.message || `Upload failed (${xhr.status})`));
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.send(formData);
      });

      window.setTimeout(() => {
        if (pendingItem.previewUrl) {
          try {
            URL.revokeObjectURL(pendingItem.previewUrl);
          } catch {
            // ignore
          }
        }
        removePendingUpload(pendingItem.tempId);
      }, 1200);

      setError("");
    } catch (err) {
      updatePendingUpload(pendingItem.tempId, {
        status: "failed",
        error: err.message || "Upload failed",
      });
      setError(err.message || "Upload failed");
    }
  }

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      cleanupVoiceRecordingStream();
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
      voicePreviewBlobRef.current = null;
    };
  }, [voicePreviewUrl]);

  function formatRecordingDuration(seconds) {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function cleanupVoiceRecordingStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  async function uploadVoiceNote(blob) {
    if (!blob || !blob.size) {
      setError("No voice note was recorded. Please record again.");
      return;
    }

    const ext = blob.type?.includes("webm")
      ? "webm"
      : blob.type?.includes("mp4")
        ? "mp4"
        : blob.type?.includes("mpeg")
          ? "mp3"
          : blob.type?.includes("wav")
            ? "wav"
            : "m4a";

    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
      type: blob.type || "audio/webm",
    });

    await uploadFile(file, { pendingType: "audio" });
  }

  async function startVoiceRecording() {
    try {
      if (isRecording) return;

      setRecordingError("");
      setError("");
      setVoicePreviewBlob(null);
      voicePreviewBlobRef.current = null;
      setRecordingSeconds(0);

      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
        setVoicePreviewUrl("");
      }

      recordingCancelledRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];

      const mimeType =
        preferredMimeTypes.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) mediaChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const wasCancelled = recordingCancelledRef.current;
          const blobType = mediaChunksRef.current[0]?.type || recorder.mimeType || "audio/webm";
          const audioBlob = new Blob(mediaChunksRef.current, { type: blobType });

          if (!wasCancelled && audioBlob.size > 0) {
            await uploadVoiceNote(audioBlob);
          }
        } catch (err) {
          setError(err.message || "Failed to send voice note");
        } finally {
          mediaChunksRef.current = [];
          mediaRecorderRef.current = null;
          cleanupVoiceRecordingStream();
          clearRecordingTimer();
          socket.emit("stop_recording_audio", { roomSlug: activeRoomSlug, installId });
          setIsRecording(false);
          recordingCancelledRef.current = false;
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      clearRecordingTimer();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
      socket.emit("recording_audio", { roomSlug: activeRoomSlug, installId });
    } catch {
      socket.emit("stop_recording_audio", { roomSlug: activeRoomSlug, installId });
      cleanupVoiceRecordingStream();
      clearRecordingTimer();
      setRecordingError("Microphone access failed.");
      setIsRecording(false);
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      socket.emit("stop_recording_audio", { roomSlug: activeRoomSlug, installId });
      cleanupVoiceRecordingStream();
      clearRecordingTimer();
      setIsRecording(false);
    }
  }

  function cancelVoiceRecording() {
    recordingCancelledRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      mediaChunksRef.current = [];
      voicePreviewBlobRef.current = null;
      mediaRecorderRef.current = null;
      socket.emit("stop_recording_audio", { roomSlug: activeRoomSlug, installId });
      cleanupVoiceRecordingStream();
      clearRecordingTimer();
      setIsRecording(false);
      recordingCancelledRef.current = false;
    }
  }

  function discardVoicePreview() {
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    setVoicePreviewUrl("");
    setVoicePreviewBlob(null);
    voicePreviewBlobRef.current = null;
    setRecordingSeconds(0);
  }

  async function sendVoicePreview() {
    const blobToSend = voicePreviewBlobRef.current || voicePreviewBlob;

    if (!blobToSend || !blobToSend.size) {
      setError("No voice note is ready to send. Please record again.");
      return;
    }

    try {
      setIsSendingVoicePreview(true);
      await uploadVoiceNote(blobToSend);
      discardVoicePreview();
    } catch (err) {
      setError(err.message || "Failed to send voice note");
    } finally {
      setIsSendingVoicePreview(false);
    }
  }

  function sendTyping() {
    if (!activeRoomSlug || !canChat) return;
    socket.emit("typing", { roomSlug: activeRoomSlug, installId });

    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("stop_typing", { roomSlug: activeRoomSlug, installId });
    }, 1200);
  }

  function stopTypingNow() {
    window.clearTimeout(typingTimeoutRef.current);
    socket.emit("stop_typing", { roomSlug: activeRoomSlug, installId });
  }

  async function handleSendMessage() {
    if (!messageInput.trim() || !canChat) return;
    socket.emit("send_message", {
      roomSlug: activeRoomSlug,
      installId,
      content: messageInput.trim(),
      replyToMessageId: replyTo?._id || null,
    });
    setMessageInput("");
    setReplyTo(null);
    stopTypingNow();
    setError("");
  }

  async function startLocalCallStream() {
    if (localCallStreamRef.current) return localCallStreamRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Your browser does not support audio/video calls.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localCallStreamRef.current = stream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    return stream;
  }

  function createPeerConnection(peerSocketId) {
    if (peerConnectionsRef.current[peerSocketId]) {
      return peerConnectionsRef.current[peerSocketId];
    }

    const pc = new RTCPeerConnection(buildRtcConfig());

    peerConnectionsRef.current[peerSocketId] = pc;

    localCallStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localCallStreamRef.current);
    });

    screenShareStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, screenShareStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit("call:signal", {
        to: peerSocketId,
        data: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const track = event.track;
      if (!remoteStream || !track) return;

      if (track.kind === "audio") {
        let audio = remoteAudioElsRef.current[peerSocketId];
        if (!audio) {
          audio = document.createElement("audio");
          audio.autoplay = true;
          audio.playsInline = true;
          document.body.appendChild(audio);
          remoteAudioElsRef.current[peerSocketId] = audio;
        }

        audio.srcObject = remoteStream;
        audio.play?.().catch(() => {});
        return;
      }

      if (track.kind === "video") {
        setRemoteVideoEnabled((current) => ({
          ...current,
          [peerSocketId]: true,
        }));
        setRemoteScreenStreams((current) => ({
          ...current,
          [peerSocketId]: remoteStream,
        }));

        track.onended = () => {
          setRemoteVideoEnabled((current) => ({
            ...current,
            [peerSocketId]: false,
          }));
          setRemoteScreenStreams((current) => {
            const next = { ...current };
            delete next[peerSocketId];
            return next;
          });
        };
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setCallConnectionState(state);

      if (state === "connected") {
        if (reconnectTimersRef.current[peerSocketId]) {
          clearTimeout(reconnectTimersRef.current[peerSocketId]);
          delete reconnectTimersRef.current[peerSocketId];
        }
        setCallError("");
        return;
      }

      if (state === "connecting") {
        setCallError("Connecting...");
        return;
      }

      if (state === "disconnected") {
        setCallError("Reconnecting...");
        if (!reconnectTimersRef.current[peerSocketId]) {
          reconnectTimersRef.current[peerSocketId] = setTimeout(() => {
            delete reconnectTimersRef.current[peerSocketId];
            const latestPc = peerConnectionsRef.current[peerSocketId];
            if (latestPc && latestPc.connectionState === "disconnected") {
              safeRestartIce(latestPc)
              renegotiatePeer(peerSocketId).catch(() => closePeerConnection(peerSocketId));
            }
          }, 3000);
        }
        return;
      }

      if (state === "failed") {
        setCallError("Connection failed. Reconnecting...");
        safeRestartIce(pc)
        renegotiatePeer(peerSocketId).catch(() => closePeerConnection(peerSocketId));
        return;
      }

      if (state === "closed") {
        closePeerConnection(peerSocketId);
      }
    };

    return pc;
  }

  function closePeerConnection(peerSocketId) {
    if (!peerSocketId) return;

    const pc = peerConnectionsRef.current[peerSocketId];
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[peerSocketId];
    }

    const audio = remoteAudioElsRef.current[peerSocketId];
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      delete remoteAudioElsRef.current[peerSocketId];
    }

    setRemoteScreenStreams((current) => {
      const next = { ...current };
      delete next[peerSocketId];
      return next;
    });
    setRemoteVideoEnabled((current) => {
      const next = { ...current };
      delete next[peerSocketId];
      return next;
    });
  }

  async function renegotiatePeer(peerSocketId) {
    const pc = peerConnectionsRef.current[peerSocketId];
    if (!pc || pc.signalingState === "closed") return;

    // Do not renegotiate while an offer/answer exchange is already active.
    if (pc.signalingState !== "stable" || makingOfferRef.current[peerSocketId]) {
      return;
    }

    try {
      makingOfferRef.current[peerSocketId] = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:signal", {
        to: peerSocketId,
        data: pc.localDescription,
      });
    } finally {
      makingOfferRef.current[peerSocketId] = false;
    }
  }

  async function startCamera(preferredFacingMode = cameraFacingMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Video calling is not supported in this browser.");
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 },
          facingMode: { ideal: preferredFacingMode },
        },
        audio: false,
      });

      const [cameraTrack] = cameraStream.getVideoTracks();
      if (!cameraTrack) return;

      cameraTrackRef.current = cameraTrack;
      if (!localCallStreamRef.current) localCallStreamRef.current = new MediaStream();
      localCallStreamRef.current.addTrack(cameraTrack);
      setLocalVideoStream(new MediaStream([cameraTrack]));
      setCameraFacingMode(preferredFacingMode);
      setIsVideoEnabled(true);
      emitLocalVideoState(true);

      cameraTrack.onended = () => {
        stopCamera().catch(() => {});
      };

      await Promise.all(
        Object.entries(peerConnectionsRef.current).map(async ([peerSocketId, pc]) => {
          pc.addTrack(cameraTrack, localCallStreamRef.current);
          await renegotiatePeer(peerSocketId);
        })
      );
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        setCallError(err.message || "Camera access failed.");
      }
    }
  }

  async function stopCamera() {
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) {
      setIsVideoEnabled(false);
      setLocalVideoStream(null);
      return;
    }

    await Promise.all(
      Object.entries(peerConnectionsRef.current).map(async ([peerSocketId, pc]) => {
        pc.getSenders()
          .filter((sender) => sender.track === cameraTrack)
          .forEach((sender) => {
            try { pc.removeTrack(sender); } catch {}
          });
        await renegotiatePeer(peerSocketId);
      })
    );

    localCallStreamRef.current?.removeTrack?.(cameraTrack);
    cameraTrack.onended = null;
    cameraTrack.stop();
    cameraTrackRef.current = null;
    setLocalVideoStream(null);
    setIsVideoEnabled(false);
    emitLocalVideoState(false);
  }

  function toggleVideo() {
    if (isVideoEnabled) {
      stopCamera().catch((err) => setCallError(err.message || "Unable to stop video."));
      return;
    }
    startCamera();
  }

  async function getCameraStreamForFacingMode(facingMode) {
    const base = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 16 / 9 },
    };

    const attempts = [
      { ...base, facingMode: { exact: facingMode } },
      { ...base, facingMode: { ideal: facingMode } },
      { ...base },
    ];

    let lastError = null;
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Unable to access camera.");
  }

  async function switchCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Camera switching is not supported in this browser.");
      return;
    }

    if (isSwitchingCameraRef.current) return;
    isSwitchingCameraRef.current = true;

    const previousTrack = cameraTrackRef.current;
    const nextFacingMode = cameraFacingMode === "user" ? "environment" : "user";

    try {
      setCallError("");

      if (previousTrack) {
        previousTrack.enabled = false;
        try { localCallStreamRef.current?.removeTrack?.(previousTrack); } catch {}
        previousTrack.onended = null;
        try { previousTrack.stop(); } catch {}
      }

      await new Promise((resolve) => window.setTimeout(resolve, 160));
      const cameraStream = await getCameraStreamForFacingMode(nextFacingMode);
      const [nextTrack] = cameraStream.getVideoTracks();
      if (!nextTrack) throw new Error("No camera track was returned.");

      nextTrack.enabled = true;
      if (!localCallStreamRef.current) localCallStreamRef.current = new MediaStream();

      setLocalVideoStream(new MediaStream([nextTrack]));
      setLocalVideoVersion((value) => value + 1);
      setCameraFacingMode(nextFacingMode);
      setIsVideoEnabled(true);
      emitLocalVideoState(true);

      await Promise.all(
        Object.entries(peerConnectionsRef.current).map(async ([peerSocketId, pc]) => {
          if (!pc || pc.signalingState === "closed") return;
          const sender = pc.getSenders().find((item) => item.track?.kind === "video");

          const replaced = await replaceOutgoingVideoTrack(pc, nextTrack, localCallStreamRef.current);
          if (!replaced) {
            pc.addTrack(nextTrack, localCallStreamRef.current);
            await renegotiatePeer(peerSocketId);
          }
        })
      );

      localCallStreamRef.current.getVideoTracks()
        .filter((track) => track !== nextTrack)
        .forEach((track) => {
          try { localCallStreamRef.current.removeTrack(track); } catch {}
          try { track.stop(); } catch {}
        });

      if (!localCallStreamRef.current.getVideoTracks().includes(nextTrack)) {
        localCallStreamRef.current.addTrack(nextTrack);
      }

      cameraTrackRef.current = nextTrack;
      nextTrack.onended = () => {
        if (cameraTrackRef.current === nextTrack) {
          stopCamera().catch(() => {});
        }
      };
    } catch (err) {
      setIsVideoEnabled(Boolean(cameraTrackRef.current && cameraTrackRef.current.readyState !== "ended"));
      setCallError(err?.message || "Unable to switch camera.");
    } finally {
      isSwitchingCameraRef.current = false;
    }
  }

  async function stopScreenShare() {
    const screenStream = screenShareStreamRef.current;
    const screenTrack = screenShareTrackRef.current;
    screenStream?.getTracks().forEach((track) => track.stop());
    screenShareStreamRef.current = null;
    screenShareTrackRef.current = null;
    setIsScreenSharing(false);

    await Promise.all(
      Object.entries(peerConnectionsRef.current).map(async ([peerSocketId, pc]) => {
        pc.getSenders()
          .filter((sender) => !screenTrack || sender.track === screenTrack)
          .forEach((sender) => {
            try {
              pc.removeTrack(sender);
            } catch {
              // Ignore tracks already removed by the browser.
            }
          });

        await renegotiatePeer(peerSocketId);
      })
    );
  }

  async function startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCallError("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const [screenTrack] = screenStream.getVideoTracks();
      if (!screenTrack) return;

      screenShareStreamRef.current = screenStream;
      screenShareTrackRef.current = screenTrack;
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        stopScreenShare().catch(() => {});
      };

      await Promise.all(
        Object.entries(peerConnectionsRef.current).map(async ([peerSocketId, pc]) => {
          pc.addTrack(screenTrack, screenStream);
          await renegotiatePeer(peerSocketId);
        })
      );
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        setCallError(err.message || "Unable to start screen sharing.");
      }
    }
  }

  function toggleScreenShare() {
    if (isScreenSharing) {
      stopScreenShare().catch((err) => setCallError(err.message || "Unable to stop screen sharing."));
      return;
    }

    startScreenShare();
  }

  function cleanupCallMedia() {
    Object.values(reconnectTimersRef.current).forEach((timerId) => clearTimeout(timerId));
    reconnectTimersRef.current = {};
    setCallConnectionState("idle");
    Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
    localCallStreamRef.current?.getTracks().forEach((track) => track.stop());
    localCallStreamRef.current = null;
    cameraTrackRef.current = null;
    setLocalVideoStream(null);
    setIsVideoEnabled(false);
    screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenShareStreamRef.current = null;
    screenShareTrackRef.current = null;
    setIsScreenSharing(false);
    setRemoteScreenStreams({});
    setRemoteVideoEnabled({});
  }

  async function enterCall(eventName, targetRoomSlug = activeRoomSlugRef.current, callType = "audio") {
    if (!targetRoomSlug || !profile?.displayName) return;

    try {
      setCallError("");
      await startLocalCallStream();
      setCallRoomSlug(targetRoomSlug);
      setInCall(true);
      setIsCallMinimized(false);
      setIsMuted(false);
      const normalizedCallType = callType === "video" ? "video" : "audio";
      setActiveCallType(normalizedCallType);
      setCallStatus(eventName === "call:start" ? "ringing" : "connected");
      setCallConnectionState("connecting");
      setCallStartedAt(eventName === "call:start" ? null : Date.now());

      socket.emit(eventName, {
        roomSlug: targetRoomSlug,
        profileId: currentProfileId,
        name: profile.displayName,
        callType: normalizedCallType,
      });
    } catch (err) {
      cleanupCallMedia();
      setInCall(false);
      setCallRoomSlug("");
      setIsCallMinimized(false);
      setCallError(err.message || "Microphone access failed.");
    }
  }

  function startCall() {
    enterCall(activeRoomHasCall ? "call:join" : "call:start", activeRoomSlugRef.current, "audio");
  }

  async function startVideoCall() {
    if (!inCallRef.current) {
      await enterCall(activeRoomHasCall ? "call:join" : "call:start", activeRoomSlugRef.current, "video");
    }

    window.setTimeout(() => {
      if (!cameraTrackRef.current) startCamera();
      setIsCallMinimized(false);
    }, 250);
  }

  function joinCall(roomSlug = activeRoomSlugRef.current) {
    const targetRoomSlug = roomSlug || activeRoomSlugRef.current;
    if (targetRoomSlug && targetRoomSlug !== activeRoomSlugRef.current) {
      setActiveRoomSlug(targetRoomSlug);
    }
    stopIncomingRingtone();
    setIncomingCall(null);
    enterCall("call:join", targetRoomSlug, incomingCall?.callType || "audio");
  }

  function declineIncomingCall() {
    const target = incomingCall;
    if (target?.roomSlug) {
      socket.emit("call:reject", {
        roomSlug: target.roomSlug,
        fromSocketId: target.fromSocketId,
        profileId: currentProfileId,
        name: profile?.displayName || "User",
      });
    }
    stopIncomingRingtone();
    setIncomingCall(null);
    setCallError("Call rejected");
    window.setTimeout(() => setCallError(""), 2500);
  }

  function leaveCall() {
    const targetRoomSlug = callRoomSlugRef.current || activeRoomSlugRef.current;
    socket.emit("call:leave", { roomSlug: targetRoomSlug });
    cleanupCallMedia();
    setInCall(false);
    setIsMuted(false);
    setIsCallMinimized(false);
    setCallRoomSlug("");
    setCallParticipants([]);
    setCallStartedAt(null);
    setCallStatus("idle");
    setActiveCallType("audio");
  }

  function toggleMute() {
    setIsMuted((current) => !current);
  }

  async function toggleStarMessage(message) {
    if (!message?._id) return;

    try {
      const res = await fetch(`${API_BASE}/api/messages/${message._id}/star`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-install-id": installId,
        },
        body: JSON.stringify({ installId }),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || "Failed to update starred message");

      const updatedMessage = data.data;
      setMessagesByRoom((current) => {
        const roomMessages = current[updatedMessage.roomSlug] || [];
        return {
          ...current,
          [updatedMessage.roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(updatedMessage._id)
              ? { ...item, ...updatedMessage, reactions: normalizeReactions(updatedMessage.reactions) }
              : item
          ),
        };
      });
    } catch (error) {
      setError(error.message || "Failed to update starred message");
    }
  }

  async function togglePinMessage(message) {
    if (!message?._id) return;

    try {
      const res = await fetch(`${API_BASE}/api/messages/${message._id}/pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-install-id": installId,
        },
        body: JSON.stringify({ installId }),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || "Failed to update pinned message");

      const updatedMessage = data.data;
      setMessagesByRoom((current) => {
        const roomMessages = current[updatedMessage.roomSlug] || [];
        return {
          ...current,
          [updatedMessage.roomSlug]: roomMessages.map((item) =>
            String(item._id) === String(updatedMessage._id)
              ? { ...item, ...updatedMessage, reactions: normalizeReactions(updatedMessage.reactions) }
              : item
          ),
        };
      });
    } catch (error) {
      setError(error.message || "Failed to update pinned message");
    }
  }

  async function forwardMessage(message) {
    if (!message?._id) return;
    const labelList = roomsSorted.map((room) => getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)).join(", ");
    const target = window.prompt(`Forward to which chat? Enter the chat name or slug. Available: ${labelList}`);
    if (!target) return;
    const normalized = target.trim().toLowerCase();
    const targetRoom = roomsSorted.find((room) => room.slug.toLowerCase() === normalized || getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles).toLowerCase() === normalized);
    if (!targetRoom) {
      setError("Chat not found. Open or create that chat first, then forward again.");
      return;
    }
    try {
      if (message.type === "text") {
        socket.emit("send_message", {
          roomSlug: targetRoom.slug,
          installId,
          content: message.content || "",
          forwardedFrom: { sender: message.sender || "", roomSlug: message.roomSlug || activeRoomSlug },
        });
      } else {
        const res = await fetch(`${API_BASE}/api/messages/${message._id}/forward`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-install-id": installId },
          body: JSON.stringify({ installId, targetRoomSlug: targetRoom.slug }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Forward failed");
      }
      setError("");
    } catch (err) {
      setError(err.message || "Forward failed");
    }
  }

  function openReactionPicker(message, position) {
    setReactionPicker({
      messageId: message._id,
      roomSlug: message.roomSlug,
      x: position.x,
      y: position.y,
    });
  }

  function startLongPressReaction(message, event) {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      const touch = event.touches?.[0];
      openReactionPicker(message, {
        x: touch?.clientX || window.innerWidth / 2,
        y: touch?.clientY || window.innerHeight / 2,
      });
    }, 450);
  }

  function cancelLongPressReaction() {
    window.clearTimeout(longPressTimerRef.current);
  }

  function openChatEmojiPicker(target) {
    const rect = target.getBoundingClientRect();
    setChatEmojiPicker({ x: rect.left, y: rect.top - 8 });
  }

  function insertChatEmoji(emoji) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? messageInput.length;
    const end = input?.selectionEnd ?? messageInput.length;

    const nextValue = messageInput.slice(0, start) + emoji + messageInput.slice(end);

    setMessageInput(nextValue);
    setChatEmojiPicker(null);

    requestAnimationFrame(() => {
      if (input) {
        input.focus();
        const nextCursor = start + emoji.length;
        input.setSelectionRange(nextCursor, nextCursor);
      }
    });
  }

  if (!session) {
    return (
      <>
        <StyleTag />
        <div className="wa-empty">Loading…</div>
      </>
    );
  }

  if (!profile?.nameLocked) {
    return (
      <>
        <StyleTag />
        <div className="wa-name-setup">
          <h2>Set your display name</h2>
          <label className="wa-avatar-upload">
            <Avatar label={displayNameInput || "You"} src={profileAvatarPreview} className="large" />
            <span>Add profile picture</span>
            
              {isRecording ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    margin: "6px 0",
                    borderRadius: 999,
                    background: "rgba(255, 59, 48, 0.08)",
                    border: "1px solid rgba(255, 59, 48, 0.18)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: "#ff3b30",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                    Recording {formatRecordingTime(recordingSeconds)}
                  </span>
                  <button
                    type="button"
                    className="wa-mini-btn"
                    onClick={cancelVoiceRecording}
                    style={{ color: "#fff", background: "#dc2626" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="wa-mini-btn"
                    onClick={stopVoiceRecording}
                    style={{ color: "#fff", background: "#16a34a" }}
                  >
                    Send
                  </button>
                </div>
              ) : null}
<input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setProfileAvatarFile(file);
                setProfileAvatarPreview(file ? URL.createObjectURL(file) : "");
              }}
            />
          </label>
          <input
            className="wa-input"
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={30}
          />
          <input
            className="wa-input"
            value={profileStatusInput}
            onChange={(e) => setProfileStatusInput(e.target.value)}
            placeholder="Profile status"
            maxLength={80}
          />
          <button className="wa-send-btn" type="button" onClick={handleSetName}>
            Start Chatting
          </button>
          {error ? <div className="wa-error">{error}</div> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <StyleTag />

      {showSidebar ? <div className="wa-mobile-overlay" onClick={() => setShowSidebar(false)} /> : null}

      <div className={`wa-app bubble-${chatPrefs.bubbleShape} font-${chatPrefs.fontSize}`} style={{ "--app-color": chatPrefs.appColor, "--accent-color": chatPrefs.accentColor, "--chat-wallpaper": chatPrefs.wallpaper, "--chat-color": chatPrefs.chatColor }}>
        <aside className={`wa-sidebar ${showSidebar ? "open" : ""}`}>
          <div className="wa-brand">Messenger</div>

          <button
            type="button"
            className="wa-profile-card"
            onClick={() => {
              setDisplayNameInput(profile.displayName || "");
              setProfileStatusInput(profile.profileStatus || "Available now");
              setProfileAvatarPreview(profile.avatarUrl || "");
              setShowProfileEditor(true);
            }}
            title="Edit profile"
          >
            <Avatar label={profile.displayName} src={profile.avatarUrl} />
            <div className="wa-profile-text">
              <div className="wa-room-title">{profile.displayName}</div>
              <div className="wa-profile-sub">{profile.profileStatus || "Available now"}</div>
            </div>
            <span className="wa-profile-edit">✎</span>
          </button>

          <div className="wa-side-switcher">
            <button
              type="button"
              className={`wa-side-tab ${sidebarMode === "chats" ? "active" : ""}`}
              onClick={() => setSidebarMode("chats")}
            >
              Chats
              {totalUnreadCount ? <span className="wa-unread-badge">{totalUnreadCount}</span> : null}
            </button>
            <button
              type="button"
              className={`wa-side-tab ${sidebarMode === "people" ? "active" : ""}`}
              onClick={() => setSidebarMode("people")}
            >
              People
            </button>
            <button
              type="button"
              className={`wa-side-tab ${sidebarMode === "calls" ? "active" : ""}`}
              onClick={() => setSidebarMode("calls")}
            >
              Calls
            </button>
            <button
              type="button"
              className={`wa-side-tab ${sidebarMode === "settings" ? "active" : ""}`}
              onClick={() => setSidebarMode("settings")}
            >
              Settings
            </button>
          </div>

          <input
            className="wa-search-input"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder={sidebarMode === "chats" ? "Search chats" : sidebarMode === "people" ? "Search people" : sidebarMode === "settings" ? "Personalize chat" : "Search calls"}
          />

          {sidebarMode === "chats" && chatSearch.trim().length >= 2 ? (
            <div className="wa-global-search-results">
              <div className="wa-section-label">Message results</div>
              {globalMessageSearchLoading ? <div className="wa-empty dark">Searching messages…</div> : null}
              {globalMessageSearchError ? <div className="wa-error">{globalMessageSearchError}</div> : null}
              {!globalMessageSearchLoading && !globalMessageSearchError && globalMessageResults.length ? (
                globalMessageResults.map((result) => (
                  <button
                    key={result._id}
                    type="button"
                    className="wa-search-result-card"
                    onClick={() => openGlobalSearchResult(result)}
                  >
                    <div className="wa-room-row-top">
                      <div className="wa-room-title">{result.roomName}</div>
                      <span className="wa-room-sub">{new Date(result.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="wa-room-sub">
                      {result.sender}: {result.preview}
                    </div>
                  </button>
                ))
              ) : null}
              {!globalMessageSearchLoading && !globalMessageSearchError && !globalMessageResults.length ? (
                <div className="wa-empty dark">No matching messages.</div>
              ) : null}
            </div>
          ) : null}

          {roomContextMenu ? (
            <div
              className="wa-room-context-menu"
              style={{ left: roomContextMenu.x, top: roomContextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  const targetSlug = roomContextMenu.roomSlug;
                  closeRoomContextMenu();
                  clearChatHistory(targetSlug);
                }}
              >
                Clear chat history
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  const targetSlug = roomContextMenu.roomSlug;
                  closeRoomContextMenu();
                  hideChatForMe(targetSlug);
                }}
              >
                Delete chat
              </button>
            </div>
          ) : null}

          {sidebarMode === "chats" ? (
            <>
              <div className="wa-section-label">Chats</div>
              {filteredRooms.map((room) => (
                <button
                  key={room.slug}
                  type="button"
                  className={`wa-room-card ${activeRoomSlug === room.slug ? "active" : ""}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openRoomContextMenu(room, event);
                  }}
                  onTouchStart={(event) => {
                    roomLongPressTimerRef.current = window.setTimeout(() => {
                      skipRoomClickRef.current = true;
                      openRoomContextMenu(room, event);
                    }, 550);
                  }}
                  onTouchEnd={() => {
                    if (roomLongPressTimerRef.current) {
                      window.clearTimeout(roomLongPressTimerRef.current);
                      roomLongPressTimerRef.current = null;
                    }
                  }}
                  onTouchMove={() => {
                    if (roomLongPressTimerRef.current) {
                      window.clearTimeout(roomLongPressTimerRef.current);
                      roomLongPressTimerRef.current = null;
                    }
                  }}
                  onClick={() => {
                    if (skipRoomClickRef.current) {
                      skipRoomClickRef.current = false;
                      return;
                    }
                    closeRoomContextMenu();
                    setActiveRoomSlug(room.slug);
                    setReplyTo(null);
                    setShowChatDetails(false);
                    setShowSidebar(false);
                  }}
                >
                  <Avatar label={getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(room)} />

                  <div className="wa-room-content">
                    <div className="wa-room-row-top">
                      <div
                        className="wa-room-title"
                        style={{ fontWeight: unreadCounts[room.slug] ? 800 : 700 }}
                      >
                        {getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)}
                      </div>

                      {room.activeCall ? <span className="wa-call-badge">Live call</span> : null}

                      {unreadCounts[room.slug] ? (
                        <span className="wa-unread-badge">{unreadCounts[room.slug]}</span>
                      ) : null}
                    </div>

                    <div
                      className="wa-room-sub"
                      style={{ fontWeight: unreadCounts[room.slug] ? 700 : 400 }}
                    >
                      {room.activeCall
                        ? `${room.activeCallParticipants?.length || 1} in voice call`
                        : room.lastMessageText || (room.slug === "general" ? "Public room" : room.slug)}
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : sidebarMode === "calls" ? (
            <>
              <div className="wa-section-label">Calls</div>
              {callHistory.length ? callHistory.map((call) => (
                <button
                  key={call._id || `${call.roomSlug}-${call.startedAt}`}
                  type="button"
                  className="wa-call-log-card wa-call-log-action"
                  onClick={() => startCallFromHistory(call)}
                  title={`Call ${getCallHistoryDisplayName(call)} again`}
                >
                  <div className="wa-room-row-top">
                    <div className="wa-room-title">{getCallHistoryDisplayName(call)}</div>
                    <span className={`wa-call-log-status ${call.status === "missed" ? "missed" : call.status === "rejected" ? "rejected" : ""}`}>
                      {call.status === "missed" ? "Missed" : call.status === "rejected" ? "Rejected" : "Answered"}
                    </span>
                  </div>
                  <div className="wa-room-sub">
                    {getCallHistoryTypeLabel(call)} · {new Date(call.startedAt).toLocaleString()} · {formatCallDuration(call.durationSeconds || 0)}
                  </div>
                </button>
              )) : <div className="wa-empty dark">No call history yet.</div>}
            </>
          ) : sidebarMode === "settings" ? (
            <>
              <div className="wa-section-label">Chat view</div>
              <div className="wa-settings-card">
                <div className="wa-settings-title">Personalize this device</div>
                <button className="wa-settings-btn" type="button" onClick={requestBrowserNotifications}>Enable call/message notifications</button>
                <div className="wa-settings-note">Allows call and message alerts while this app is minimized, in another tab, or behind another window.</div>
                <label className="wa-settings-label">App color <input className="wa-color-input" type="color" value={chatPrefs.appColor} onChange={(e) => updateChatPref("appColor", e.target.value)} /></label>
                <label className="wa-settings-label">Accent color <input className="wa-color-input" type="color" value={chatPrefs.accentColor} onChange={(e) => updateChatPref("accentColor", e.target.value)} /></label>
                <label className="wa-settings-label">Chat color <input className="wa-color-input" type="color" value={chatPrefs.chatColor} onChange={(e) => updateChatPref("chatColor", e.target.value)} /></label>
                <label className="wa-settings-label">Wallpaper <input className="wa-color-input" type="color" value={chatPrefs.wallpaper} onChange={(e) => updateChatPref("wallpaper", e.target.value)} /></label>
                <label className="wa-settings-label">Bubble style <select className="wa-select" value={chatPrefs.bubbleShape} onChange={(e) => updateChatPref("bubbleShape", e.target.value)}><option value="rounded">Rounded</option><option value="soft">Soft</option><option value="square">Compact square</option></select></label>
                <label className="wa-settings-label">Font size <select className="wa-select" value={chatPrefs.fontSize} onChange={(e) => updateChatPref("fontSize", e.target.value)}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
              </div>
            </>
          ) : (
            <>
              <div className="wa-section-label">People</div>
              {filteredProfiles.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  className="wa-user-card"
                  onClick={() => startDirectRoom(user._id)}
                >
                  <Avatar label={user.displayName} src={user.avatarUrl} />
                  <div className="wa-user-content">
                    <div className="wa-user-name">{user.displayName}</div>
                    <div className="wa-user-sub">{user.profileStatus || "Available now"}</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </aside>

        <section className="wa-main">
          <header className="wa-header">
            <div className="wa-header-left">
              <button
                type="button"
                className="wa-icon-btn"
                onClick={() => setShowSidebar((v) => !v)}
                title="Open sidebar"
              >
                ☰
              </button>

              <Avatar label={getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(activeRoom)} className="header" />

              <button type="button" className="wa-header-title-wrap clickable" onClick={() => setShowChatDetails(true)} title="View chat details">
                <div className="wa-header-title">
                  {getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)}
                </div>
                <div className="wa-header-sub">
                  {recordingName
                    ? `${recordingName} is recording audio…`
                    : typingName
                      ? `${typingName} is typing…`
                      : activeRoomHasCall
                        ? `${callParticipants.length || activeRoom?.activeCallParticipants?.length || 1} in call`
                        : activeRoom?.isDirect
                          ? "Private chat"
                          : "Group chat"}
                </div>
              </button>
            </div>

            <div className="wa-header-right">
              <button
                type="button"
                className={`wa-icon-btn call-action `}
                onClick={inCall ? () => joinCall() : startCall}
                title={inCall ? "Open call" : activeRoomHasCall ? "Join call" : "Start audio call"}
              >
                {activeRoomHasCall && !inCall ? "Join" : <span className="wa-call-icon">☎</span>}
              </button>

              <button
                type="button"
                className={`wa-icon-btn call-action `}
                onClick={startVideoCall}
                title={inCall ? "Turn on video" : "Start video call"}
              >
                <span className="wa-call-icon">📹</span>
              </button>

              <button
                type="button"
                className="wa-icon-btn"
                onClick={() => exportChat("txt")}
                title="Export chat as text"
              >
                ⬇
              </button>

              <button
                type="button"
                className="wa-icon-btn"
                onClick={() => setShowMessageSearch((v) => !v)}
                title="Search messages"
              >
                🔍
              </button>
            </div>
          </header>

          {showMessageSearch ? (
            <div className="wa-message-search-wrap">
              <input
                className="wa-search-input"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Search messages in this chat"
                style={{ marginBottom: 0 }}
              />
            </div>
          ) : null}

          {error ? <div className="wa-error">{error}</div> : null}
          {recordingError ? <div className="wa-error">{recordingError}</div> : null}
          {callError ? <div className="wa-error">{callError}</div> : null}

          {showChatDetails ? (
            <main className="wa-details-page">
              <div className="wa-details-topbar">
                <button type="button" className="wa-details-back" onClick={() => setShowChatDetails(false)} title="Back to chat">← Back</button>
                <strong>Chat details</strong>
              </div>
              <section className="wa-details-hero">
                <Avatar label={getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(activeRoom)} className="details" />
                <h2>{getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)}</h2>
                <p>{activeRoom?.isDirect ? (activeRoomOtherProfile?.profileStatus || "No status") : "General group chat"}</p>
              </section>

              <section className="wa-details-actions">
                <button type="button" onClick={startCall}>☎ Audio call</button>
                <button type="button" onClick={startVideoCall}>📹 Video call</button>
                <button type="button" onClick={() => setShowMessageSearch(true)}>🔍 Search</button>
                <button type="button" onClick={() => exportChat("txt")}>⬇ Export TXT</button>
                <button type="button" onClick={() => exportChat("json")}>⬇ Export JSON</button>
                <button type="button" onClick={() => clearChatHistory()}>Clear history</button>
              </section>

              <section className="wa-settings-card wa-details-card">
                <div className="wa-settings-title">Chat theme</div>
                <label className="wa-settings-label">Wallpaper <input className="wa-color-input" type="color" value={chatPrefs.wallpaper} onChange={(e) => updateChatPref("wallpaper", e.target.value)} /></label>
                <label className="wa-settings-label">Bubble style <select className="wa-select" value={chatPrefs.bubbleShape} onChange={(e) => updateChatPref("bubbleShape", e.target.value)}><option value="rounded">Rounded</option><option value="soft">Soft</option><option value="square">Compact square</option></select></label>
                <label className="wa-settings-label">Font size <select className="wa-select" value={chatPrefs.fontSize} onChange={(e) => updateChatPref("fontSize", e.target.value)}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
              </section>

              <section className="wa-details-card">
                <div className="wa-details-card-title">Starred messages in this chat</div>
                <div className="wa-empty">⭐ {activeStarredCount} starred message{activeStarredCount === 1 ? "" : "s"}</div>
              </section>

              <section className="wa-details-card">
                <div className="wa-details-card-title">Media in this chat</div>
                {activeRoomMedia.length ? (
                  <div className="wa-media-grid">
                    {activeRoomMedia.map((message) => (
                      <a key={message._id} href={resolveMediaUrl(message.fileUrl)} target="_blank" rel="noreferrer" className="wa-media-item">
                        <span>{message.type === "audio" ? "🎤" : "📎"}</span>
                        <small>{message.fileName || message.content || "Media"}</small>
                      </a>
                    ))}
                  </div>
                ) : <div className="wa-empty">No media shared yet.</div>}
              </section>

              <section className="wa-details-card danger-zone">
                <div className="wa-details-card-title">Chat management</div>
                <button type="button" className="wa-danger-text-btn" onClick={() => clearChatHistory()}>Clear history for me</button>
                <button type="button" className="wa-danger-text-btn" onClick={() => hideChatForMe(activeRoomSlug)}>Delete chat from my list</button>
              </section>
            </main>
          ) : (
            <>
          <main
            ref={messageListRef}
            className={`wa-chat ${isDragOver ? "drag-over" : ""}`}
            onDragEnter={(e) => {
              if (e.dataTransfer?.types?.includes("Files")) {
                e.preventDefault();
                setIsDragOver(true);
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer?.types?.includes("Files")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setIsDragOver(true);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFileSelect(e.dataTransfer?.files);
            }}
          >
            {activePinnedMessages.length ? (
              <div className="wa-pinned-strip">
                <strong>📌 Pinned</strong>
                {activePinnedMessages.slice(-3).map((message) => (
                  <button
                    key={message._id}
                    type="button"
                    className="wa-pinned-item"
                    onClick={() => {
                      setHighlightedSearchMessageId(message._id);
                      setTimeout(() => scrollToMessage(message._id), 80);
                    }}
                  >
                    {(message.type === "audio" ? "Voice note" : message.fileName || message.content || "Message").slice(0, 70)}
                  </button>
                ))}
              </div>
            ) : null}

            {isDragOver ? <div className="wa-drop-overlay">Drop files to upload</div> : null}

            {!groupedMessages.length && !pendingUploadsForRoom.length ? (
              <div className="wa-empty">No messages yet.</div>
            ) : null}

            {groupedMessages.map((entry, index) =>
              entry.type === "day" ? (
                <div key={`day-${entry.label}-${index}`} className="wa-day-separator">
                  <div className="wa-day-pill">{entry.label}</div>
                </div>
              ) : (
                <MessageBubble
                  key={entry.message._id || `${entry.message.createdAt}-${index}`}
                  message={entry.message}
                  highlightedMessageId={highlightedSearchMessageId}
                  currentProfileId={currentProfileId}
                  activeAudioId={activeAudioId}
                  setActiveAudioId={setActiveAudioId}
                  listenedMap={listenedMap}
                  markPlayed={markPlayed}
                  onReply={setReplyTo}
                  onDelete={deleteMessage}
                  onOpenReactionPicker={openReactionPicker}
                  onStartLongPressReaction={startLongPressReaction}
                  onCancelLongPressReaction={cancelLongPressReaction}
                  onReact={reactToMessage}
                  onForward={forwardMessage}
                  onToggleStar={toggleStarMessage}
                  onTogglePin={togglePinMessage}
                  isGroupChat={isGroupChat}
                  getProfileNameById={getProfileNameById}
                  getProfileAvatarById={getProfileAvatarById}
                />
              )
            )}

            {pendingUploadsForRoom.map((item) => (
              <div key={item.tempId} className="wa-message-row mine pending">
                <div className="wa-bubble mine pending">
                  {item.type === "audio" ? (
                    <div className="wa-audio-wrap">
                      <div className="wa-audio-label">🎤 Voice note</div>
                      <div className="wa-uploading-audio">
                        Transferring voice note… {Math.max(0, Math.min(item.progress || 0, 100))}%
                      </div>
                      <div className="wa-upload-progress">
                        <span style={{ width: `${Math.max(0, Math.min(item.progress || 0, 100))}%` }} />
                      </div>
                    </div>
                  ) : (
                    <AttachmentPreview item={item} pending />
                  )}

                  <div className="wa-meta">
                    <span>
                      {item.status === "failed"
                        ? item.error || "Failed"
                        : item.status === "processing"
                          ? "Processing…"
                          : item.status === "queued"
                            ? "Queued…"
                            : `Transferring ${Math.max(0, Math.min(item.progress || 0, 100))}%`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </main>

          <footer className="wa-composer">
            <button
              type="button"
              className="wa-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              📎
            </button>

            <button
              type="button"
              className="wa-icon-btn"
              title="Add emoji"
              onClick={(e) => {
                e.stopPropagation();
                openChatEmojiPicker(e.currentTarget);
              }}
            >
              😊
            </button>

            <button
              type="button"
              className={`wa-icon-btn ${isRecording ? "recording" : ""}`}
              title={isRecording ? "Stop and send recording" : "Start recording"}
              onClick={() => {
                if (isRecording) stopVoiceRecording();
                else startVoiceRecording();
              }}
            >
              {isRecording ? "⏹" : "🎤"}
            </button>

            {isRecording ? (
              <button
                type="button"
                className="wa-icon-btn"
                title="Cancel recording"
                onClick={cancelVoiceRecording}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  fontWeight: 800,
                  minWidth: 44,
                }}
              >
                ✕
              </button>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z,audio/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="wa-input-wrap">
              {isRecording ? (
                <div className="wa-recording-panel">
                  <span className="wa-recording-dot" />
                  <span className="wa-recording-timer">
                    Recording… {formatRecordingDuration(recordingSeconds)}
                  </span>
                  <button type="button" className="wa-mini-btn primary" onClick={stopVoiceRecording}>
                    Send
                  </button>
                  <button type="button" className="wa-mini-btn danger" onClick={cancelVoiceRecording}>
                    Cancel
                  </button>
                </div>
              ) : null}

              {replyTo ? (
                <div className="wa-reply-card" style={{ marginBottom: 8 }}>
                  <div className="wa-reply-sender">Replying to {replyTo.sender}</div>
                  <div>{replyTo.fileName || replyTo.content}</div>
                </div>
              ) : null}

              <input
                ref={messageInputRef}
                className="wa-input"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  sendTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Message ${
                  getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles) ||
                  slugifyRoomName(activeRoomSlug || "general")
                }`}
              />
            </div>

            <button type="button" className="wa-send-btn" onClick={handleSendMessage}>
              Send
            </button>
          </footer>
            </>
          )}
        </section>
      </div>


      {showProfileEditor ? (
        <div className="wa-modal-backdrop" onClick={() => setShowProfileEditor(false)}>
          <div className="wa-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-title">Edit profile</div>
            <label className="wa-avatar-upload">
              <Avatar label={displayNameInput || profile?.displayName} src={profileAvatarPreview || profile?.avatarUrl} className="large" />
              <span>Change profile picture</span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setProfileAvatarFile(file);
                  setProfileAvatarPreview(file ? URL.createObjectURL(file) : (profile?.avatarUrl || ""));
                }}
              />
            </label>
            <input
              className="wa-input"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Display name"
              maxLength={30}
            />
            <input
              className="wa-input"
              value={profileStatusInput}
              onChange={(e) => setProfileStatusInput(e.target.value)}
              placeholder="Profile status"
              maxLength={80}
            />
            <div className="wa-modal-actions">
              <button type="button" className="wa-icon-btn" onClick={() => setShowProfileEditor(false)}>Cancel</button>
              <button type="button" className="wa-send-btn" onClick={handleSetName}>Save</button>
            </div>
          </div>
        </div>
      ) : null}


      {showPwaInstallPrompt ? (
        <div className="wa-pwa-install-card">
          <div>
            <strong>Install Int Messager</strong>
            <span>Use it like a mobile app from your home screen.</span>
          </div>
          <button type="button" onClick={installPwaApp}>Install</button>
          <button type="button" className="ghost" onClick={() => setShowPwaInstallPrompt(false)}>Later</button>
        </div>
      ) : null}

      {reactionPicker ? (
        <div
          className="wa-reaction-picker"
          style={{
            left: Math.max(12, reactionPicker.x - 80),
            top: Math.max(12, reactionPicker.y - 56),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {REACTION_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="wa-reaction-option"
              onClick={() => reactToMessage(reactionPicker.messageId, emoji)}
            >
              {emoji}
            </button>
          ))}
          <button type="button" className="wa-reaction-close" onClick={() => setReactionPicker(null)}>
            ×
          </button>
        </div>
      ) : null}

      {chatEmojiPicker ? (
        <div
          className="wa-chat-emoji-picker"
          style={{
            left: Math.max(12, chatEmojiPicker.x - 20),
            top: Math.max(12, chatEmojiPicker.y - 70),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {CHAT_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" className="wa-chat-emoji-option" onClick={() => insertChatEmoji(emoji)}>
              {emoji}
            </button>
          ))}
          <button type="button" className="wa-chat-emoji-close" onClick={() => setChatEmojiPicker(null)}>
            ×
          </button>
        </div>
      ) : null}

      {incomingCall ? (
        <div className="wa-incoming-call">
          <div className="wa-incoming-title">
            {incomingCall.roomSlug === "general"
              ? "Incoming General call"
              : `${incomingCall.name || "Someone"} is calling`}
          </div>
          {incomingCall.roomSlug === "general" ? (
            <div className="wa-incoming-sub">
              {incomingCall.name || "Someone"} is calling in General
            </div>
          ) : null}
          <div className="wa-incoming-actions">
            <button type="button" className="wa-call-btn secondary" onClick={declineIncomingCall}>
              Decline
            </button>
            <button type="button" className="wa-call-btn" onClick={() => joinCall(incomingCall.roomSlug)}>
              Join
            </button>
          </div>
        </div>
      ) : null}

      {inCall && isCallMinimized ? (
        <div
          className={`wa-call-floating ${callControlsVisible ? "show-controls" : ""} ${floatingDragRef.current ? "is-dragging" : ""} ${minimizedRemoteVideoEntry ? "has-video" : "audio-only"}`}
          onPointerMove={revealCallControls}
          onTouchStart={revealCallControls}
          onPointerDown={startFloatingCallDrag}
          style={floatingCallPosition ? { left: floatingCallPosition.x, top: floatingCallPosition.y, right: "auto", bottom: "auto" } : undefined}
        >
          <div className="wa-call-floating-video-preview">
            {minimizedRemoteVideoEntry ? (
              <>
                <video
                  ref={(node) => {
                    if (node && node.srcObject !== minimizedRemoteVideoEntry[1]) {
                      node.srcObject = minimizedRemoteVideoEntry[1];
                      node.play?.().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                />
                <span className="wa-call-floating-video-label">{getCallParticipantDisplayName(minimizedRemoteVideoEntry[0])}</span>
              </>
            ) : (
              <div className="wa-call-floating-audio-state">
                <div className="wa-call-floating-title">{currentCallTitle}</div>
                <div className="wa-call-floating-sub">
                  {callStatus === "ringing"
                    ? "Ringing..."
                    : callConnectionState === "disconnected" || callConnectionState === "failed" || callConnectionState === "connecting"
                      ? `${callConnectionState === "connecting" ? "Connecting" : callConnectionState === "disconnected" ? "Reconnecting" : "Recovering connection"}...`
                      : currentCallIsDirect
                        ? `Private call · ${formatCallDuration(callDuration)}`
                        : `${visibleCallParticipants.length} in group call · ${formatCallDuration(callDuration)}`}
                </div>
              </div>
            )}

            <button
              type="button"
              className="wa-call-floating-open"
              onClick={(event) => {
                event.stopPropagation();
                setIsCallMinimized(false);
              }}
              title="Open call"
              aria-label="Open call"
            >
              ⤢
            </button>

            <div className="wa-call-floating-controls" onPointerDown={(event) => event.stopPropagation()}>
              <button type="button" className={`wa-call-icon-btn ${isMuted ? "is-active" : ""}`} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? "🔇" : "🎤"}
              </button>
              <button type="button" className={`wa-call-icon-btn ${!isVideoEnabled ? "is-active" : ""}`} onClick={toggleVideo} title={isVideoEnabled ? "Stop video" : "Start video"} aria-label={isVideoEnabled ? "Stop video" : "Start video"}>
                {isVideoEnabled ? "🚫" : "📷"}
              </button>
              {isVideoEnabled ? (
                <button type="button" className="wa-call-icon-btn" onClick={switchCamera} title="Switch camera" aria-label="Switch camera">
                  🔄
                </button>
              ) : null}
              <button type="button" className={`wa-call-icon-btn ${isScreenSharing ? "is-active" : ""}`} onClick={toggleScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"} aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}>
                🖥️
              </button>
              <button type="button" className="wa-call-icon-btn danger" onClick={leaveCall} title="End call" aria-label="End call">
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inCall && !isCallMinimized ? (
        <div className="wa-call-overlay">
          <div
            className={`wa-call-card ${callControlsVisible ? "show-controls" : ""} ${hasVisibleVideo ? "video-active" : ""}`}
            onPointerMove={revealCallControls}
            onTouchStart={revealCallControls}
          >
            <div className="wa-call-card-head">
              <div className="wa-call-card-head-main">
                <div className="wa-call-title">{currentCallTitle}</div>
                <div className="wa-call-subtitle">
                  {callStatus === "ringing"
                  ? "Ringing..."
                  : callConnectionState === "disconnected" || callConnectionState === "failed" || callConnectionState === "connecting"
                    ? `${callConnectionState === "connecting" ? "Connecting" : callConnectionState === "disconnected" ? "Reconnecting" : "Recovering connection"}...`
                    : currentCallIsDirect
                      ? `Private call · ${formatCallDuration(callDuration)}`
                      : `${visibleCallParticipants.length} in group call · ${formatCallDuration(callDuration)}`}
                </div>
              </div>
              <button type="button" className="wa-call-minimize" onClick={() => setIsCallMinimized(true)} title="Minimize call">
                −
              </button>
            </div>

            {!hasVisibleVideo ? (
              <div className="wa-audio-call-fill" aria-hidden="true">
                <div className="wa-audio-call-pulse">☎</div>
              </div>
            ) : null}

            {hasVisibleVideo ? (
              <div className="wa-video-grid">
                {localVideoStream ? (
                  <div className="wa-video-tile">
                    <video
                      key={`local-video-${localVideoVersion}`}
                      ref={(node) => {
                        if (node && node.srcObject !== localVideoStream) {
                          node.srcObject = localVideoStream;
                          node.muted = true;
                          node.play?.().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        const tile = video.closest(".wa-video-tile");
                        const isPortrait = video.videoHeight > video.videoWidth;
                        tile?.classList.toggle("portrait", isPortrait);
                        tile?.classList.toggle("landscape", !isPortrait);
                      }}
                    />
                    <span className="wa-video-label">Me</span>
                  </div>
                ) : null}

                {visibleRemoteVideoEntries.map(([peerSocketId, stream]) => (
                  <div className="wa-video-tile" key={peerSocketId}>
                    <video
                      ref={(node) => {
                        if (node && node.srcObject !== stream) {
                          node.srcObject = stream;
                          node.play?.().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        const tile = video.closest(".wa-video-tile");
                        const isPortrait = video.videoHeight > video.videoWidth;
                        tile?.classList.toggle("portrait", isPortrait);
                        tile?.classList.toggle("landscape", !isPortrait);
                      }}
                    />
                    <span className="wa-video-label">{getCallParticipantDisplayName(peerSocketId)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {false && Object.keys(remoteScreenStreams).length ? (
              <div className="wa-screen-share-grid">
                {Object.entries(remoteScreenStreams).map(([peerSocketId, stream]) => (
                  <video
                    key={peerSocketId}
                    className="wa-screen-video"
                    ref={(node) => {
                      if (node && node.srcObject !== stream) {
                        node.srcObject = stream;
                        node.play?.().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                  />
                ))}
              </div>
            ) : null}

            <div className="wa-call-participants">
              {visibleCallParticipants.map((participant, index) => (
                <div className="wa-call-person" key={`${participant.profileId || participant.name}-${index}`}>
                  <Avatar label={participant.displayName} src={participant.avatarUrl} />
                  <span>{participant.displayName}</span>
                </div>
              ))}
            </div>
            <div className="wa-call-actions">
              <button type="button" className="wa-call-btn secondary" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? "🔇" : "🎤"}
              </button>

              <button type="button" className="wa-call-btn secondary" onClick={toggleVideo} title={isVideoEnabled ? "Stop video" : "Start video"} aria-label={isVideoEnabled ? "Stop video" : "Start video"}>
                {isVideoEnabled ? "🚫" : "📷"}
              </button>

              {isVideoEnabled ? (
                <button type="button" className="wa-call-btn secondary" onClick={switchCamera} title="Switch camera" aria-label="Switch camera">
                  🔄
                </button>
              ) : null}

              <button type="button" className="wa-call-btn secondary" onClick={toggleScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"} aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}>
                🖥️
              </button>

              <button type="button" className="wa-call-btn danger" onClick={leaveCall} title="End call" aria-label="End call">
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
