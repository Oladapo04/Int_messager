import React, { useEffect, useMemo, useRef, useState } from "react";
import DeviceSessions from "./components/DeviceSessions";
import AdminDashboard from "./components/admin/AdminDashboard";
import { apiFetch as authFetch, AUTH_TOKEN_KEY } from "./services/api";
import { buildRtcConfig, safeSetRemoteDescription, safeRestartIce, replaceOutgoingVideoTrack } from "./call/webrtcUtils";
import io from "socket.io-client";
import "./Version3.css";
import "./styles/layout-v474.css";
import "./styles/premium-v474.css";
import "./themes.css";
import "./styles/whatsapp-chat-v487.css";
import "./styles/group-text-v488.css";
import "./styles/group-text-template-v489.css";
import "./styles/pdf-attachment-v4810.css";
import "./styles/mobile-chat-header-v4811.css";
import "./styles/desktop-chat-details-v4812.css";
import "./styles/responsive-chat-details-v4814.css";
import "./styles/fullscreen-chat-info-v4815.css";
import "./styles/desktop-chat-info-pane-v4816.css";
import "./styles/mobile-hamburger-remove-v4817.css";
import "./styles/black-call-icon-v4818.css";
import "./styles/admin-dashboard-v490.css";
import "./styles/presence-receipts-v497.css";
import "./styles/group-management-v499.css";
import "./styles/contacts-blocking-v4100.css";
import "./styles/dark-mode-v491.css";
import "./styles/admin-access-v492.css";
import "./styles/admin-dashboard-v493.css";
import "./styles/composer-layout-v495.css";
import "./styles/mobile-composer-overlap-v4101.css";
import "./styles/shared-content-v4102.css";
import "./styles/advanced-search-v4103.css";
import "./styles/privacy-controls-v4104.css";
import "./styles/call-experience-v4105.css";
import "./styles/disappearing-messages-v4107.css";
import "./styles/mobile-navigation-composer-v4108.css";
import "./styles/profile-icon-position-v4108a.css";
import "./styles/drafts-scheduled-v4109.css";
import "./styles/glass-navigation-v4110.css";
import AuthScreen from "./components/auth/AuthScreen";
import NavigationRail from "./components/layout/NavigationRail";
import StatusUpdates from "./components/status/StatusUpdates";
import MessageActions, { DesktopMessageContextMenu, MobileMessageActionSheet } from "./components/chat/MessageActions";
import AttachmentRenderer from "./components/chat/AttachmentRenderer";
import ConversationView from "./components/chat/ConversationView";
import MessageList from "./components/chat/MessageList";
import Composer from "./components/composer/Composer";
import { editMessageRequest, deleteMessageRequest } from "./services/messageService";
import "./styles/dark-mode-visibility-v4113.css";
import "./styles/dark-mode-contrast-v4114.css";
import "./styles/dark-mode-critical-text-v4115.css";
import "./styles/dark-mode-settings-chat-v4116.css";
import "./styles/unified-theme-system-v4117.css";
import "./styles/dark-mode-professional-v4120.css";
import "./styles/dark-mode-premium-v4121.css";
import "./styles/mobile-conversation-premium-v4122.css";
import "./styles/light-mode-premium-v4123.css";

const API_BASE = "";
const socket = io(API_BASE, { autoConnect: true });

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}


const INSTALL_ID_KEY = "int_messager_install_id";
const PLAYED_KEY = "wa_voice_played_map";
const REACTION_OPTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "💯", "😆", "😎", "🤔", "😡", "💔", "✅", "👀", "🙌"];
const CHAT_EMOJIS = ["😀", "😁", "😂", "🤣", "😍", "😘", "😊", "😎", "😭", "😢", "😮", "😡", "🤔", "🙏", "❤️", "💔", "👍", "👎", "👏", "🙌", "🔥", "🎉", "💯", "✅", "👀", "✨", "🚀", "🎤", "📎", "📞"];
const CHAT_PREFS_KEY = "int_messager_chat_prefs_v1";
const PWA_BEFORE_INSTALL_PROMPT = "beforeinstallprompt";
const ACCOUNT_INSTALL_ID_KEY = "int_messager_account_install_id_v4";
const DESKTOP_SIDEBAR_WIDTH_KEY = "int_messager_desktop_sidebar_width_v44";
const APPEARANCE_MODE_KEY = "int_messager_appearance_mode_v491";
const DRAFTS_STORAGE_PREFIX = "int_messager_drafts_v4109";

const APP_THEME_PRESETS = {
  "light-grey": { label: "Classic", light: { app: "#eef2f6", sidebar: "#f8fafc", surface: "#ffffff", surface2: "#f1f5f9", chat: "#eaf0f6", incoming: "#ffffff", outgoing: "#d9fdd3", text: "#0f172a", muted: "#64748b", border: "#d8e0e8", accent: "#1687d9" }, dark: { app: "#0b141a", sidebar: "#111b21", surface: "#17232c", surface2: "#202c33", chat: "#0b141a", incoming: "#202c33", outgoing: "#005c4b", text: "#f0f2f5", muted: "#aebac1", border: "#2a3942", accent: "#00a884" } },
  "soft-blue": { label: "Ocean Blue", light: { app: "#edf5ff", sidebar: "#f7fbff", surface: "#ffffff", surface2: "#e7f1fb", chat: "#e8f3ff", incoming: "#ffffff", outgoing: "#d8ebff", text: "#10233f", muted: "#61758c", border: "#cbdced", accent: "#1677c8" }, dark: { app: "#091622", sidebar: "#0d1d2b", surface: "#132638", surface2: "#193149", chat: "#08131d", incoming: "#173047", outgoing: "#174f72", text: "#f2f8ff", muted: "#b4c8d9", border: "#29465f", accent: "#4ab3ff" } },
  "emerald": { label: "Emerald", light: { app: "#edf8f3", sidebar: "#f7fcfa", surface: "#ffffff", surface2: "#e4f3ec", chat: "#e8f5ef", incoming: "#ffffff", outgoing: "#d3f3e2", text: "#123126", muted: "#627c72", border: "#c8ded4", accent: "#16835f" }, dark: { app: "#081713", sidebar: "#0d211a", surface: "#132b22", surface2: "#17372b", chat: "#081510", incoming: "#163529", outgoing: "#075e4b", text: "#effbf6", muted: "#b1cfc2", border: "#285242", accent: "#34d399" } },
  "violet": { label: "Violet", light: { app: "#f3efff", sidebar: "#faf8ff", surface: "#ffffff", surface2: "#eee8ff", chat: "#f0ecfb", incoming: "#ffffff", outgoing: "#e6dcff", text: "#24173f", muted: "#75678d", border: "#d8cff0", accent: "#7357d4" }, dark: { app: "#100c1a", sidebar: "#171123", surface: "#21182f", surface2: "#2a1f3c", chat: "#0f0a18", incoming: "#261d36", outgoing: "#4f3a78", text: "#f7f3ff", muted: "#c8bce0", border: "#493960", accent: "#a78bfa" } },
  "rose": { label: "Rose", light: { app: "#fff1f4", sidebar: "#fff9fa", surface: "#ffffff", surface2: "#fce7ec", chat: "#fff0f3", incoming: "#ffffff", outgoing: "#fbd8e0", text: "#3b1721", muted: "#8b6670", border: "#efd0d8", accent: "#d64a72" }, dark: { app: "#190d11", sidebar: "#221117", surface: "#301820", surface2: "#3b1d27", chat: "#170b0f", incoming: "#361c25", outgoing: "#6d2d42", text: "#fff3f6", muted: "#dfbdc7", border: "#613443", accent: "#fb7185" } },
  "graphite": { label: "Graphite", light: { app: "#eceff1", sidebar: "#f7f8f9", surface: "#ffffff", surface2: "#e7eaed", chat: "#eef0f2", incoming: "#ffffff", outgoing: "#dce3e8", text: "#151a1e", muted: "#68727a", border: "#cfd5da", accent: "#4f6678" }, dark: { app: "#101214", sidebar: "#16191c", surface: "#1d2226", surface2: "#262c31", chat: "#0e1012", incoming: "#252b30", outgoing: "#35434c", text: "#f3f5f6", muted: "#bbc3c8", border: "#3a444b", accent: "#8ba4b5" } },
  "midnight": { label: "Midnight", light: { app: "#eef2fb", sidebar: "#f7f9ff", surface: "#ffffff", surface2: "#e7edf8", chat: "#edf2fa", incoming: "#ffffff", outgoing: "#dbe6fa", text: "#101b33", muted: "#63718b", border: "#cdd7ea", accent: "#315fb3" }, dark: { app: "#070d18", sidebar: "#0c1424", surface: "#111d30", surface2: "#17253b", chat: "#060b14", incoming: "#18263b", outgoing: "#203d69", text: "#f2f6ff", muted: "#b7c5dc", border: "#2a4060", accent: "#60a5fa" } },
};

function getAppThemePalette(themeName, appearance) {
  const preset = APP_THEME_PRESETS[themeName] || APP_THEME_PRESETS["light-grey"];
  return preset[appearance === "dark" ? "dark" : "light"];
}

function draftStorageKey(profileId) {
  return `${DRAFTS_STORAGE_PREFIX}:${String(profileId || "guest")}`;
}

function loadDraftMap(profileId) {
  if (!profileId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(draftStorageKey(profileId)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDraftMap(profileId, drafts) {
  if (!profileId) return;
  try {
    localStorage.setItem(draftStorageKey(profileId), JSON.stringify(drafts || {}));
  } catch {
    // Draft persistence is best-effort when browser storage is unavailable.
  }
}

function defaultScheduleInputValue(minutesAhead = 10) {
  const date = new Date(Date.now() + Math.max(1, Number(minutesAhead) || 10) * 60 * 1000);
  date.setSeconds(0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatScheduledMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Scheduled";
  return date.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactDraftPreview(value, maxLength = 58) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function formatRecordingTime(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getAuthToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ""; }


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
    theme: "light-grey",
    appColor: "#f1f3f5",
    accentColor: "#1d4ed8",
    wallpaper: "#e9edf2",
    chatColor: "#dbeafe",
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

function disappearingLabel(seconds) {
  const value = Number(seconds || 0);
  if (value === 86400) return "24 hours";
  if (value === 604800) return "7 days";
  if (value === 7776000) return "90 days";
  return "Off";
}

function expiryCountdownLabel(expiresAt) {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expiring";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `Expires in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `Expires in ${days}d`;
}

function formatPresenceLabel(profile) {
  if (!profile) return "Private chat";
  if (profile.online) return "Online";
  if (!profile.lastSeenAt) return profile.profileStatus || "Private chat";

  const seen = new Date(profile.lastSeenAt);
  if (Number.isNaN(seen.getTime())) return profile.profileStatus || "Private chat";

  const now = new Date();
  const sameDay = seen.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = seen.toDateString() === yesterday.toDateString();
  const time = seen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `Last seen today at ${time}`;
  if (wasYesterday) return `Last seen yesterday at ${time}`;
  return `Last seen ${seen.toLocaleDateString([], { day: "numeric", month: "short" })} at ${time}`;
}

function MessageReceipt({ status = "sent" }) {
  const normalized = ["sent", "delivered", "seen"].includes(status) ? status : "sent";
  const symbol = normalized === "sent" ? "✓" : "✓✓";
  const label = normalized === "seen" ? "Seen" : normalized === "delivered" ? "Delivered" : "Sent";
  return <span className={`wa-receipt wa-receipt-${normalized}`} title={label} aria-label={label}>{symbol}</span>;
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

function isVideoAttachment(item) {
  return guessMimeType(item).startsWith("video/");
}

function isAudioAttachment(item) {
  return item?.type === "audio" || guessMimeType(item).startsWith("audio/");
}

function extractMessageLinks(value) {
  const text = String(value || "");
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.!?;:]+$/, "")))];
}

function formatSharedItemDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
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
  if (room.isSaved || String(room.slug || "").startsWith("saved:")) return "Saved Messages";
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

      .wa-launch-screen {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        background: #0f172a;
      }

      .wa-launch-logo {
        width: 132px;
        height: 132px;
        object-fit: contain;
        border-radius: 30px;
        animation: wa-launch-pop 0.65s ease-out;
      }

      .wa-launch-name {
        color: #ffffff;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 0.02em;
        animation: wa-launch-fade 0.8s ease-out;
      }

      .wa-header-app-logo {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        object-fit: contain;
        border-radius: 10px;
      }

      .wa-welcome-screen {
        min-height: 0;
        height: 100%;
        overflow-y: auto;
        padding: 28px;
        background:
          radial-gradient(circle at top, rgba(14, 165, 233, 0.10), transparent 35%),
          linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
      }

      .wa-welcome-content {
        width: min(100%, 760px);
        min-height: 100%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .wa-welcome-logo {
        width: 88px;
        height: 88px;
        object-fit: contain;
        border-radius: 22px;
        margin-bottom: 18px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
        animation: wa-welcome-arrive 0.7s cubic-bezier(.2,.8,.2,1);
      }

      .wa-welcome-screen h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 900;
        color: #0f172a;
      }

      .wa-welcome-tagline {
        margin: 8px 0 0;
        font-size: 16px;
        font-weight: 700;
        color: #0ea5e9;
      }

      .wa-welcome-intro {
        max-width: 430px;
        margin: 12px 0 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.5;
      }

      .wa-home-profile {
        width: min(100%, 540px);
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 22px;
        padding: 12px 14px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
        text-align: left;
      }

      .wa-home-profile-copy { min-width: 0; flex: 1; }
      .wa-home-profile-name { font-weight: 900; color: #0f172a; }
      .wa-home-profile-status { margin-top: 3px; color: #64748b; font-size: 13px; }

      .wa-home-actions {
        width: min(100%, 540px);
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }

      .wa-home-action {
        min-height: 72px;
        border: 0;
        border-radius: 16px;
        padding: 12px 10px;
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
        cursor: pointer;
        font-weight: 800;
      }

      .wa-home-action:hover { transform: translateY(-1px); }
      .wa-home-action-icon { display: block; margin-bottom: 6px; font-size: 20px; }

      .wa-home-section {
        width: min(100%, 540px);
        margin-top: 20px;
        text-align: left;
      }

      .wa-home-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 9px;
        color: #334155;
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .wa-home-count {
        min-width: 24px;
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--accent-color, #22c55e);
        color: #fff;
        text-align: center;
        font-size: 12px;
      }

      .wa-home-room-list { display: grid; gap: 8px; }

      .wa-home-room {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 11px;
        border: 1px solid rgba(148, 163, 184, 0.20);
        border-radius: 16px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.9);
        cursor: pointer;
        text-align: left;
      }

      .wa-home-room:hover { background: #fff; }
      .wa-home-room-copy { min-width: 0; flex: 1; }
      .wa-home-room-name { color: #0f172a; font-weight: 850; }
      .wa-home-room-preview { margin-top: 3px; overflow: hidden; color: #64748b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
      .wa-home-room-unread { min-width: 24px; padding: 4px 7px; border-radius: 999px; background: var(--accent-color, #22c55e); color: white; font-size: 11px; font-weight: 900; text-align: center; }
      .wa-home-empty { padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.72); color: #64748b; font-size: 13px; text-align: center; }

      @keyframes wa-welcome-arrive {
        from { opacity: 0; transform: translateY(-24px) scale(1.18); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (max-width: 560px) {
        .wa-welcome-screen { padding: 20px 14px; }
        .wa-welcome-content { justify-content: flex-start; padding-top: 30px; }
        .wa-home-actions { grid-template-columns: 1fr; }
        .wa-home-action { min-height: 54px; }
      }

      @keyframes wa-launch-pop {
        from { opacity: 0; transform: scale(0.72); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes wa-launch-fade {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
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


      /* 2026 commercial UI/UX refresh */
      :root {
        color-scheme: light;
      }

      body {
        background:
          radial-gradient(circle at 10% 10%, rgba(99,102,241,.13), transparent 28%),
          radial-gradient(circle at 90% 90%, rgba(14,165,233,.12), transparent 30%),
          #eef2f7;
        overflow: hidden;
      }

      button, input, select, textarea { font: inherit; }
      button { -webkit-tap-highlight-color: transparent; }
      button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--accent-color, #6366f1) 34%, transparent);
        outline-offset: 2px;
      }

      .wa-app {
        grid-template-columns: 356px minmax(0, 1fr);
        height: 100dvh;
        max-width: 1720px;
        margin: 0 auto;
        background: rgba(255,255,255,.7);
        box-shadow: 0 24px 80px rgba(15,23,42,.14);
        overflow: hidden;
      }

      .wa-sidebar {
        background:
          linear-gradient(180deg, rgba(15,23,42,.98), rgba(20,29,53,.97)),
          #0f172a;
        padding: 18px 16px 20px;
        border-right: 1px solid rgba(148,163,184,.16);
        scrollbar-width: thin;
        scrollbar-color: rgba(148,163,184,.28) transparent;
      }

      .wa-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 42px;
        margin: 0 2px 16px;
        letter-spacing: -.02em;
        font-size: 19px;
      }
      .wa-brand img {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        box-shadow: 0 8px 22px rgba(0,0,0,.28);
      }

      .wa-profile-card {
        padding: 12px;
        margin-bottom: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.055));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        transition: transform .18s ease, background .18s ease, border-color .18s ease;
      }
      .wa-profile-card:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,.13);
        border-color: rgba(255,255,255,.14);
      }

      .wa-side-switcher {
        padding: 4px;
        gap: 3px;
        background: rgba(2,6,23,.34);
        border: 1px solid rgba(148,163,184,.10);
        border-radius: 14px;
        margin-bottom: 13px;
      }
      .wa-side-tab {
        min-height: 38px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 750;
        letter-spacing: .01em;
        transition: background .18s ease, color .18s ease, transform .18s ease;
      }
      .wa-side-tab:hover { background: rgba(255,255,255,.07); }
      .wa-side-tab.active {
        background: rgba(255,255,255,.14);
        box-shadow: 0 5px 14px rgba(0,0,0,.16), inset 0 1px rgba(255,255,255,.08);
      }

      .wa-search-input {
        min-height: 44px;
        border: 1px solid rgba(148,163,184,.12);
        border-radius: 13px;
        background: rgba(2,6,23,.34);
        color: #f8fafc;
        padding: 0 14px;
        transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
      }
      .wa-search-input::placeholder { color: #94a3b8; }
      .wa-search-input:focus {
        background: rgba(2,6,23,.52);
        border-color: color-mix(in srgb, var(--accent-color, #6366f1) 60%, white 8%);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-color, #6366f1) 18%, transparent);
      }

      .wa-section-label {
        margin: 17px 7px 8px;
        color: #94a3b8;
        font-size: 10px;
        letter-spacing: .16em;
        text-transform: uppercase;
        font-weight: 850;
      }

      .wa-room-card, .wa-user-card, .wa-call-log-card, .wa-search-result-card {
        border: 1px solid transparent;
        border-radius: 15px;
        margin-bottom: 5px;
        padding: 11px 10px;
        transition: transform .16s ease, background .16s ease, border-color .16s ease;
      }
      .wa-room-card:hover, .wa-user-card:hover, .wa-call-log-card:hover, .wa-search-result-card:hover {
        transform: translateX(2px);
        background: rgba(255,255,255,.095);
      }
      .wa-room-card.active {
        background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color, #6366f1) 35%, transparent), rgba(255,255,255,.09));
        border-color: color-mix(in srgb, var(--accent-color, #6366f1) 46%, transparent);
        box-shadow: 0 9px 22px rgba(2,6,23,.18);
      }
      .wa-room-title { letter-spacing: -.012em; }
      .wa-room-sub, .wa-user-sub, .wa-profile-sub { color: #a9b6c8; line-height: 1.35; }
      .wa-unread-badge {
        min-width: 21px;
        height: 21px;
        padding: 0 6px;
        box-shadow: 0 5px 12px color-mix(in srgb, var(--accent-color, #6366f1) 34%, transparent);
      }

      .wa-main {
        min-width: 0;
        background: color-mix(in srgb, var(--chat-wallpaper, #e8edf3) 88%, white 12%);
        position: relative;
      }
      .wa-main::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 15%, rgba(255,255,255,.72), transparent 28%),
          radial-gradient(circle at 84% 82%, color-mix(in srgb, var(--accent-color, #6366f1) 7%, transparent), transparent 30%);
        z-index: 0;
      }
      .wa-main > * { position: relative; z-index: 1; }

      .wa-header {
        min-height: 72px;
        padding: 10px 18px;
        background: rgba(255,255,255,.82);
        border-bottom: 1px solid rgba(148,163,184,.20);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        box-shadow: 0 4px 22px rgba(15,23,42,.045);
      }
      .wa-header-title { font-size: 16px; letter-spacing: -.018em; }
      .wa-header-sub { color: #64748b; }
      .wa-header-app-logo { border-radius: 12px; box-shadow: 0 7px 18px rgba(15,23,42,.13); }

      .wa-icon-btn {
        width: 41px;
        height: 41px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,.20);
        background: rgba(255,255,255,.72);
        box-shadow: 0 4px 12px rgba(15,23,42,.055);
        transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
      }
      .wa-icon-btn:hover {
        transform: translateY(-1px);
        background: #fff;
        box-shadow: 0 8px 18px rgba(15,23,42,.10);
      }

      .wa-chat {
        padding: 22px clamp(14px, 3vw, 42px) 118px;
        scroll-padding-bottom: 104px;
      }
      .wa-message-row { margin: 3px 0; }
      .wa-bubble {
        max-width: min(680px, 76%);
        border: 1px solid rgba(148,163,184,.16);
        box-shadow: 0 5px 18px rgba(15,23,42,.065);
        line-height: 1.48;
      }
      .wa-message-row.own .wa-bubble {
        border-color: color-mix(in srgb, var(--chat-color, #2563eb) 42%, transparent);
        box-shadow: 0 7px 20px color-mix(in srgb, var(--chat-color, #2563eb) 14%, transparent);
      }

      .wa-composer-wrap {
        padding: 10px clamp(12px, 2.5vw, 28px) 14px;
        background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.88) 28%);
        border-top: 0;
      }
      .wa-composer {
        max-width: 1040px;
        margin: 0 auto;
        padding: 8px;
        border-radius: 20px;
        border: 1px solid rgba(148,163,184,.23);
        background: rgba(255,255,255,.91);
        box-shadow: 0 14px 36px rgba(15,23,42,.13);
        backdrop-filter: blur(14px);
      }
      .wa-message-input, .wa-composer textarea {
        min-height: 44px;
        background: transparent;
      }
      .wa-send-btn {
        min-height: 42px;
        border-radius: 13px;
        box-shadow: 0 8px 18px color-mix(in srgb, var(--accent-color, #6366f1) 24%, transparent);
        transition: transform .16s ease, filter .16s ease;
      }
      .wa-send-btn:hover { transform: translateY(-1px); filter: brightness(1.04); }

      .wa-welcome-screen {
        padding: 28px;
        background: transparent;
      }
      .wa-welcome-content {
        width: min(920px, 100%);
        min-height: min(720px, calc(100dvh - 128px));
        margin: 0 auto;
        padding: clamp(24px, 4vw, 50px);
        border: 1px solid rgba(255,255,255,.75);
        border-radius: 32px;
        background: linear-gradient(145deg, rgba(255,255,255,.75), rgba(255,255,255,.48));
        box-shadow: 0 30px 80px rgba(15,23,42,.10), inset 0 1px rgba(255,255,255,.85);
        backdrop-filter: blur(22px) saturate(135%);
        -webkit-backdrop-filter: blur(22px) saturate(135%);
      }
      .wa-welcome-logo {
        width: 88px;
        height: 88px;
        padding: 4px;
        border-radius: 25px;
        box-shadow: 0 20px 45px rgba(15,23,42,.18);
      }
      .wa-welcome-screen h1 { font-size: clamp(30px, 5vw, 48px); letter-spacing: -.045em; }
      .wa-welcome-tagline { font-size: 16px; color: #475569; }
      .wa-welcome-intro { max-width: 580px; color: #64748b; line-height: 1.65; }
      .wa-home-action, .wa-home-chat-card {
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(255,255,255,.70);
        box-shadow: 0 8px 22px rgba(15,23,42,.055);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .wa-home-action:hover, .wa-home-chat-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 15px 30px rgba(15,23,42,.10);
        border-color: color-mix(in srgb, var(--accent-color, #6366f1) 32%, transparent);
      }

      .wa-modal-backdrop {
        background: rgba(2,6,23,.55);
        backdrop-filter: blur(8px);
      }
      .wa-profile-modal, .wa-chat-details-panel, .wa-call-card {
        border: 1px solid rgba(255,255,255,.78);
        box-shadow: 0 30px 90px rgba(2,6,23,.26);
      }

      @media (max-width: 1100px) {
        .wa-app { grid-template-columns: 320px minmax(0, 1fr); }
        .wa-chat { padding-inline: 18px; }
      }

      @media (max-width: 900px) {
        body { background: #eef2f7; }
        .wa-app { display: block; width: 100vw; max-width: none; }
        .wa-sidebar {
          width: min(88vw, 340px);
          max-width: none;
          box-shadow: 24px 0 70px rgba(2,6,23,.38);
        }
        .wa-header { min-height: 66px; padding: 8px 10px; }
        .wa-welcome-screen { padding: 12px; }
        .wa-welcome-content {
          min-height: calc(100dvh - 90px);
          padding: 24px 16px;
          border-radius: 24px;
        }
        .wa-bubble { max-width: 88%; }
        .wa-composer-wrap { padding: 8px 8px max(10px, env(safe-area-inset-bottom)); }
        .wa-composer { border-radius: 17px; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          scroll-behavior: auto !important;
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
        }
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
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onScrollToReply,
  onOpenDesktopMenu,
  onStartLongPressReaction,
  onCancelLongPressReaction,
  onReact,
  onForward,
  onToggleStar,
  onTogglePin,
  isGroupChat,
  isSequenceStart = true,
  isSequenceEnd = true,
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
  const isPlainTextMessage = !message.isDeleted && !["audio", "file", "image", "video"].includes(message.type || "text");
  const useGroupTextTemplate = Boolean(!mine && isGroupChat && isPlainTextMessage);

  const content = (
    <>
      {!mine && isGroupChat && isSequenceStart ? <div className="wa-sender-name wa-sender-name-inside wa-group-text-sender">{senderDisplayName}</div> : null}

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
        <button type="button" className="wa-reply-card wa-reply-card-button" onClick={() => onScrollToReply(message.replyTo.messageId)}>
          <div className="wa-reply-sender">{message.replyTo.sender}</div>
          <div>{message.replyTo.fileName || message.replyTo.content}</div>
        </button>
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
        <AttachmentRenderer item={message} resolveMediaUrl={resolveMediaUrl} />
      ) : (
        <div className={`wa-message-text ${useGroupTextTemplate ? "wa-group-text-body" : ""} ${message.isDeleted ? "deleted" : ""}`}>{message.content}</div>
      )}

      <ReactionBar reactions={message.reactions} onReact={(emoji) => onReact(message._id, emoji)} />

      <div className={`wa-meta ${useGroupTextTemplate ? "wa-group-text-meta" : ""}`}> 
        <span>{formatTime(message.createdAt)}</span>
        {message.isEdited ? <span className="wa-edited-label">Edited</span> : null}
        {message.expiresAt ? <span className="wa-expiry-meta" title={new Date(message.expiresAt).toLocaleString()}>⏱ {expiryCountdownLabel(message.expiresAt)}</span> : null}
        {mine ? <MessageReceipt status={message.status || "sent"} /> : null}
        {!message.isDeleted ? (
          <MessageActions
            onOpen={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenDesktopMenu(message, { x: rect.right + 8, y: rect.top });
            }}
          />
        ) : null}
      </div>
    </>
  );

  if (mine) {
    return (
      <div
        className={`wa-message-row mine ${isSequenceStart ? "sequence-start" : "sequence-middle"} ${isSequenceEnd ? "sequence-end" : ""} ${String(message._id || "") === String(highlightedMessageId || "") ? "search-highlight" : ""}`}
        data-message-id={String(message._id || "")}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenDesktopMenu(message, { x: event.clientX, y: event.clientY });
        }}
        onTouchStart={(e) => onStartLongPressReaction(message, e)}
        onTouchEnd={onCancelLongPressReaction}
        onTouchMove={onCancelLongPressReaction}
        onTouchCancel={onCancelLongPressReaction}
      >
        <div className={`wa-bubble mine wa-bubble-${message.type || "text"} ${isSequenceStart ? "sequence-start" : "sequence-middle"} ${isSequenceEnd ? "sequence-end" : ""} ${message.replyTo?.messageId ? "has-reply" : ""}`}>{content}</div>
      </div>
    );
  }

  return (
    <div
      className={`wa-message-row other ${isSequenceStart ? "sequence-start" : "sequence-middle"} ${isSequenceEnd ? "sequence-end" : ""} ${String(message._id || "") === String(highlightedMessageId || "") ? "search-highlight" : ""}`}
      data-message-id={String(message._id || "")}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenDesktopMenu(message, { x: event.clientX, y: event.clientY });
      }}
      onTouchStart={(e) => onStartLongPressReaction(message, e)}
      onTouchEnd={onCancelLongPressReaction}
      onTouchMove={onCancelLongPressReaction}
      onTouchCancel={onCancelLongPressReaction}
    >
      <div className="wa-message-other-wrap">
        {isGroupChat ? (isSequenceEnd ? <Avatar label={senderDisplayName} src={senderAvatarUrl} className="message" /> : <span className="wa-avatar-spacer" aria-hidden="true" />) : null}

        <div className="wa-message-content-wrap">
          <div className={`wa-bubble wa-bubble-${message.type || "text"} ${useGroupTextTemplate ? "wa-group-text-template" : ""} ${isSequenceStart ? "sequence-start" : "sequence-middle"} ${isSequenceEnd ? "sequence-end" : ""} ${message.replyTo?.messageId ? "has-reply" : ""}`}>{content}</div>
        </div>
      </div>
    </div>
  );
}

async function prepareProfileImage(file) {
  if (!file) return null;

  const maxInputSize = 25 * 1024 * 1024;
  if (file.size > maxInputSize) {
    throw new Error("The selected picture is too large. Please choose an image smaller than 25 MB.");
  }

  const supportedWithoutConversion = ["image/jpeg", "image/png", "image/webp"];
  if (supportedWithoutConversion.includes(file.type) && file.size <= 4 * 1024 * 1024) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("This picture format could not be read. Please choose a JPG, PNG or WebP image."));
      img.src = objectUrl;
    });

    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the selected picture.");
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("The selected picture could not be prepared for upload.");

    const baseName = (file.name || "profile-picture").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function App() {
  const legacyInstallId = useMemo(() => getOrCreateInstallId(), []);
  const [installId, setInstallId] = useState(() => localStorage.getItem(ACCOUNT_INSTALL_ID_KEY) || legacyInstallId);
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authChecked, setAuthChecked] = useState(false);

  const [session, setSession] = useState(null);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [showPwaInstallPrompt, setShowPwaInstallPrompt] = useState(false);
  const [profile, setProfile] = useState(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileStatusInput, setProfileStatusInput] = useState("Available now");
  const [profileAvatarFile, setProfileAvatarFile] = useState(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileSavePending, setProfileSavePending] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activeRoomSlug, setActiveRoomSlug] = useState("");
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [messageInput, setMessageInput] = useState("");
  const [draftsByRoom, setDraftsByRoom] = useState({});
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [showScheduleMessage, setShowScheduleMessage] = useState(false);
  const [scheduleContent, setScheduleContent] = useState("");
  const [scheduleAt, setScheduleAt] = useState(() => defaultScheduleInputValue());
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState("");
  const [error, setError] = useState("");
  const [typingName, setTypingName] = useState("");
  const [recordingName, setRecordingName] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [forwardPickerMessage, setForwardPickerMessage] = useState(null);
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [listenedMap, setListenedMap] = useState(loadPlayedMap);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [mobileMessageActions, setMobileMessageActions] = useState(null);
  const [desktopMessageActions, setDesktopMessageActions] = useState(null);
  const [chatEmojiPicker, setChatEmojiPicker] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [globalMessageResults, setGlobalMessageResults] = useState([]);
  const [globalMessageSearchLoading, setGlobalMessageSearchLoading] = useState(false);
  const [globalMessageSearchError, setGlobalMessageSearchError] = useState("");
  const [globalSearchType, setGlobalSearchType] = useState("all");
  const [globalSearchSender, setGlobalSearchSender] = useState("");
  const [globalSearchDateFrom, setGlobalSearchDateFrom] = useState("");
  const [globalSearchDateTo, setGlobalSearchDateTo] = useState("");
  const [highlightedSearchMessageId, setHighlightedSearchMessageId] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [sharedContentTab, setSharedContentTab] = useState("media");
  const [showMobileChatMenu, setShowMobileChatMenu] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sidebarMode, setSidebarMode] = useState("chats");
  const [developerStatus, setDeveloperStatus] = useState("");
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem(DESKTOP_SIDEBAR_WIDTH_KEY));
    return Number.isFinite(savedWidth) && savedWidth >= 440 && savedWidth <= 620 ? savedWidth : 520;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [chatPrefs, setChatPrefs] = useState(loadChatPrefs);
  const [roomContextMenu, setRoomContextMenu] = useState(null);
  const [chatOrgPrefs, setChatOrgPrefs] = useState({ pinnedRooms: [], archivedRooms: [], mutedRooms: [], manuallyUnreadRooms: [], keepArchivedOnNewMessage: true });
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState(() => {
    const saved = localStorage.getItem(APPEARANCE_MODE_KEY);
    return ["light", "dark", "system"].includes(saved) ? saved : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false
  );
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState([]);
  const [groupManageBusy, setGroupManageBusy] = useState(false);
  const [groupManageNotice, setGroupManageNotice] = useState("");
  const [contactManageBusyId, setContactManageBusyId] = useState("");
  const [contactManageNotice, setContactManageNotice] = useState("");
  const [privacySettings, setPrivacySettings] = useState({
    lastSeenPrivacy: "everyone",
    onlinePrivacy: "everyone",
    profilePhotoPrivacy: "everyone",
    readReceipts: true,
  });
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [disappearingBusy, setDisappearingBusy] = useState(false);
  const [disappearingNotice, setDisappearingNotice] = useState("");
  const [expiryClock, setExpiryClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setExpiryClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile?.role !== "admin" && showAdminDashboard) {
      setShowAdminDashboard(false);
    }
  }, [profile?.role, showAdminDashboard]);
  const [adminAccessCheck, setAdminAccessCheck] = useState(null);
  const [adminAccessBusy, setAdminAccessBusy] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [voicePreviewBlob, setVoicePreviewBlob] = useState(null);
  const [isSendingVoicePreview, setIsSendingVoicePreview] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const syncSystemAppearance = (event) => setSystemPrefersDark(Boolean(event.matches));
    setSystemPrefersDark(Boolean(media.matches));
    media.addEventListener?.("change", syncSystemAppearance);
    return () => media.removeEventListener?.("change", syncSystemAppearance);
  }, []);

  const resolvedAppearance = appearanceMode === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : appearanceMode;
  const activeAppTheme = getAppThemePalette(chatPrefs.theme || "light-grey", resolvedAppearance);

  useEffect(() => {
    localStorage.setItem(APPEARANCE_MODE_KEY, appearanceMode);
    document.documentElement.dataset.intMessagerAppearance = resolvedAppearance;
    document.documentElement.style.colorScheme = resolvedAppearance;

    const themeColor = resolvedAppearance === "dark"
      ? (activeAppTheme.sidebar || activeAppTheme.app || "#0b141a")
      : (activeAppTheme.sidebar || activeAppTheme.app || "#f8fafc");
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", themeColor);
    document.body.style.backgroundColor = themeColor;
  }, [appearanceMode, resolvedAppearance, activeAppTheme.sidebar, activeAppTheme.app]);

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
  const remoteTypingTimeoutRef = useRef(null);
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
  const mutedRoomsRef = useRef([]);
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
    if (!currentProfileId) {
      setDraftsByRoom({});
      setScheduledMessages([]);
      return;
    }
    setDraftsByRoom(loadDraftMap(currentProfileId));
  }, [currentProfileId]);

  useEffect(() => {
    if (!activeRoomSlug) {
      setMessageInput("");
      return;
    }
    const nextDraft = draftsByRoom[activeRoomSlug] || "";
    setMessageInput((current) => (current === nextDraft ? current : nextDraft));
  }, [activeRoomSlug, currentProfileId, draftsByRoom]);

  useEffect(() => {
    if (!currentProfileId) return undefined;
    loadScheduledMessages();
    const handleScheduledMessagesUpdated = () => loadScheduledMessages();
    socket.on("scheduled_messages_updated", handleScheduledMessagesUpdated);
    return () => socket.off("scheduled_messages_updated", handleScheduledMessagesUpdated);
  }, [currentProfileId, installId]);

  async function loadPrivacySettings() {
    if (!canChat) return;
    try {
      const response = await authFetch(`${API_BASE}/api/privacy`, { headers: { "x-install-id": installId } });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Failed to load privacy settings");
      if (payload?.data) setPrivacySettings(payload.data);
    } catch (err) {
      console.warn("Privacy settings load failed:", err);
    }
  }

  async function updatePrivacySetting(name, value) {
    const next = { ...privacySettings, [name]: value };
    setPrivacySettings(next);
    setPrivacyBusy(true);
    setPrivacyNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify(next),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Failed to update privacy settings");
      setPrivacySettings(payload.data || next);
      setPrivacyNotice("Privacy setting saved.");
      window.setTimeout(() => setPrivacyNotice(""), 1800);
    } catch (err) {
      setPrivacyNotice(err?.message || "Failed to update privacy settings");
      await loadPrivacySettings();
    } finally {
      setPrivacyBusy(false);
    }
  }

  useEffect(() => {
    if (canChat) loadPrivacySettings();
  }, [canChat, installId]);

  useEffect(() => {
    mutedRoomsRef.current = Array.isArray(chatOrgPrefs.mutedRooms) ? chatOrgPrefs.mutedRooms : [];
  }, [chatOrgPrefs.mutedRooms]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Notification service worker registration failed:", err);
    });
  }, []);


  async function enablePushNotifications() {
    try {
      if (!("Notification" in window)) {
        alert("Notifications are not supported on this device.");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        alert("Push notifications are not supported on this browser.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notifications were not allowed.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        alert("Notifications are already enabled.");
        return;
      }

      const keyRes = await authFetch(`${API_BASE}/api/push/public-key`);
      const keyPayload = await keyRes.json();
      if (!keyRes.ok || !keyPayload.publicKey) throw new Error(keyPayload.error || "Push public key is not configured.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });

      const saveRes = await authFetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-install-id": installId,
        },
        body: JSON.stringify({ installId, subscription }),
      });
      const savePayload = await saveRes.json();
      if (!saveRes.ok || savePayload.success === false) throw new Error(savePayload.error || "Failed to save notification subscription.");

      alert("Notifications enabled.");
    } catch (error) {
      console.error("Enable notifications error:", error);
      alert(error.message || "Failed to enable notifications.");
    }
  }

  async function updateArchiveBehaviour(keepArchivedOnNewMessage) {
    try {
      const res = await authFetch(`${API_BASE}/api/chat-preferences/archive-behaviour`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepArchivedOnNewMessage }),
      });
      const payload = await res.json();
      if (!res.ok || payload.success === false) throw new Error(payload.error || "Failed to update archive behaviour.");
      setChatOrgPrefs(payload.data);
    } catch (error) {
      setError(error.message || "Failed to update archive behaviour.");
    }
  }

  async function runDeveloperHealthCheck() {
    try {
      setDeveloperStatus("Checking…");
      const started = performance.now();
      const res = await fetch(`${API_BASE}/api`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setDeveloperStatus(`Server online · ${Math.round(performance.now() - started)} ms · Socket ${socket.connected ? "connected" : "disconnected"}`);
    } catch (error) {
      setDeveloperStatus(`Health check failed: ${error.message}`);
    }
  }

  async function resetDeveloperCache() {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((registrations || []).map((registration) => registration.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      setDeveloperStatus("Service worker and caches cleared. Reloading…");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setDeveloperStatus(`Cache reset failed: ${error.message}`);
    }
  }

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
        badge: "/vite.svg",
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
    if ((mutedRoomsRef.current || []).includes(message.roomSlug)) return;
    if (!shouldNotifyNow(message.roomSlug)) return;
    if (String(message.senderProfileId || "") === String(currentProfileId || "")) return;
    const room = roomsSorted.find((item) => item.slug === message.roomSlug);
    const chatName = room
      ? getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)
      : message.roomSlug === "general"
        ? "General"
        : "New message";
    const isDirectRoom = Boolean(room?.isDirect);
    const preview = message.type === "audio"
      ? "Voice note"
      : message.type === "file"
        ? message.fileName || "Attachment"
        : String(message.content || "New message").slice(0, 180);
    const body = isDirectRoom ? preview : `${message.sender || "Someone"}: ${preview}`;
    showLocalNotification({
      title: isDirectRoom ? (message.sender || chatName) : chatName,
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
    const pinnedOrder = (chatOrgPrefs.pinnedRooms || []).filter((slug) => slug && !String(slug).startsWith("saved:"));
    const pinnedIndex = new Map(pinnedOrder.map((slug, index) => [slug, index]));
    const manualUnread = new Set(chatOrgPrefs.manuallyUnreadRooms || []);
    return [...rooms].sort((a, b) => {
      const savedDiff = Number(Boolean(b.isSaved)) - Number(Boolean(a.isSaved));
      if (savedDiff) return savedDiff;
      const aPinned = pinnedIndex.has(a.slug);
      const bPinned = pinnedIndex.has(b.slug);
      if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
      if (aPinned && bPinned) return pinnedIndex.get(a.slug) - pinnedIndex.get(b.slug);
      const aUnread = Number(unreadCounts[a.slug] || 0) + Number(manualUnread.has(a.slug));
      const bUnread = Number(unreadCounts[b.slug] || 0) + Number(manualUnread.has(b.slug));
      if (bUnread !== aUnread) return bUnread - aUnread;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [rooms, unreadCounts, chatOrgPrefs]);

  const activeRoom = useMemo(
    () => roomsSorted.find((room) => room.slug === activeRoomSlug) || null,
    [roomsSorted, activeRoomSlug]
  );

  // Open the exact conversation selected from a push notification. Wait until
  // rooms are loaded so a cold-started PWA can navigate reliably.
  useEffect(() => {
    if (!roomsSorted.length) return;
    const params = new URLSearchParams(window.location.search);
    const requestedRoom = params.get("room");
    if (!requestedRoom) return;
    if (!roomsSorted.some((room) => room.slug === requestedRoom)) return;
    setSidebarMode("chats");
    setActiveRoomSlug(requestedRoom);
    setShowChatDetails(false);
    setShowSidebar(false);
    params.delete("room");
    params.delete("call");
    const nextQuery = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`);
  }, [roomsSorted]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCounts || {}).reduce((total, count) => total + Number(count || 0), 0),
    [unreadCounts]
  );

  const unreadRooms = useMemo(
    () => roomsSorted.filter((room) => Number(unreadCounts[room.slug] || 0) > 0).slice(0, 3),
    [roomsSorted, unreadCounts]
  );

  const recentRooms = useMemo(
    () => roomsSorted.filter((room) => Number(unreadCounts[room.slug] || 0) === 0).slice(0, 3),
    [roomsSorted, unreadCounts]
  );

  function openHomeRoom(roomSlug) {
    if (!roomSlug) return;
    setSidebarMode("chats");
    setActiveRoomSlug(roomSlug);
    setReplyTo(null);
    setShowChatDetails(false);
    setShowSidebar(false);
  }

  const filteredRooms = useMemo(
    () =>
      roomsSorted.filter((room) => {
        const archived = !room.isSaved && (chatOrgPrefs.archivedRooms || []).includes(room.slug);
        if (showArchivedChats !== archived) return false;
        return getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)
          .toLowerCase()
          .includes(chatSearch.toLowerCase());
      }),
    [roomsSorted, chatSearch, profile?.displayName, chatOrgPrefs.archivedRooms, showArchivedChats]
  );

  const filteredProfiles = useMemo(
    () =>
      profiles.filter((user) =>
        user.displayName.toLowerCase().includes(chatSearch.toLowerCase())
      ),
    [profiles, chatSearch]
  );

  const savedContactIds = useMemo(() => new Set((profile?.savedContacts || []).map(String)), [profile?.savedContacts]);
  const favoriteContactIds = useMemo(() => new Set((profile?.favoriteContacts || []).map(String)), [profile?.favoriteContacts]);
  const blockedProfileIds = useMemo(() => new Set((profile?.blockedProfiles || []).map(String)), [profile?.blockedProfiles]);
  const favoriteProfiles = useMemo(() => filteredProfiles.filter((user) => favoriteContactIds.has(String(user._id)) && !blockedProfileIds.has(String(user._id))), [filteredProfiles, favoriteContactIds, blockedProfileIds]);
  const savedProfiles = useMemo(() => filteredProfiles.filter((user) => savedContactIds.has(String(user._id)) && !favoriteContactIds.has(String(user._id)) && !blockedProfileIds.has(String(user._id))), [filteredProfiles, savedContactIds, favoriteContactIds, blockedProfileIds]);
  const otherProfiles = useMemo(() => filteredProfiles.filter((user) => !savedContactIds.has(String(user._id)) && !blockedProfileIds.has(String(user._id))), [filteredProfiles, savedContactIds, blockedProfileIds]);
  const blockedProfiles = useMemo(() => profiles.filter((user) => blockedProfileIds.has(String(user._id))), [profiles, blockedProfileIds]);

  const rawMessages = (messagesByRoom[activeRoomSlug] || []).filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > expiryClock);

  const activePinnedMessages = useMemo(
    () => rawMessages.filter((message) => !message.isDeleted && message.pinned),
    [rawMessages]
  );

  const activeStarredCount = useMemo(
    () => rawMessages.filter((message) => Array.isArray(message.starredBy) && message.starredBy.some((id) => String(id) === String(currentProfileId || ""))).length,
    [rawMessages, currentProfileId]
  );

  const activeRoomSharedContent = useMemo(() => {
    const media = [];
    const docs = [];
    const voice = [];
    const links = [];

    rawMessages.forEach((message) => {
      if (!message || message.isDeleted) return;

      if (isAudioAttachment(message)) {
        voice.push(message);
      } else if (message.type === "file" || message.fileUrl) {
        if (isImageAttachment(message) || isVideoAttachment(message)) media.push(message);
        else docs.push(message);
      }

      if (message.type === "text" && message.content) {
        extractMessageLinks(message.content).forEach((url) => {
          links.push({
            id: `${message._id || message.createdAt}-${url}`,
            url,
            sender: message.sender || "User",
            createdAt: message.createdAt,
          });
        });
      }
    });

    const newestFirst = (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    media.sort(newestFirst);
    docs.sort(newestFirst);
    voice.sort(newestFirst);
    links.sort(newestFirst);

    return { media, docs, links, voice };
  }, [rawMessages]);

  const activeSharedContentItems = activeRoomSharedContent[sharedContentTab] || [];

  const activeRoomOtherProfile = useMemo(() => {
    if (!activeRoom?.isDirect) return null;
    const otherProfileId = (activeRoom.participants || [])
      .map((id) => String(id))
      .find((id) => id && id !== String(currentProfileId || ""));
    return profiles.find((user) => String(user._id) === String(otherProfileId)) || null;
  }, [activeRoom, profiles, currentProfileId]);
  const activeDirectContactId = activeRoomOtherProfile?._id ? String(activeRoomOtherProfile._id) : "";
  const activeDirectContactBlocked = Boolean(activeDirectContactId && blockedProfileIds.has(activeDirectContactId));
  const activeDirectContactSaved = Boolean(activeDirectContactId && savedContactIds.has(activeDirectContactId));
  const activeDirectContactFavorite = Boolean(activeDirectContactId && favoriteContactIds.has(activeDirectContactId));

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
  const isGroupChat = activeRoom ? !activeRoom.isDirect && activeRoom.type !== "saved" : false;
  const isManagedGroup = Boolean(activeRoom?.isGroup);
  const currentUserIsGroupOwner = Boolean(isManagedGroup && String(activeRoom?.ownerProfileId || "") === String(currentProfileId || ""));
  const currentUserIsGroupAdmin = Boolean(isManagedGroup && (currentUserIsGroupOwner || (activeRoom?.groupAdmins || []).some((id) => String(id) === String(currentProfileId || ""))));
  const activeGroupMembers = isManagedGroup
    ? (activeRoom?.participants || []).map((id) => {
        const memberId = String(id);
        const found = profiles.find((user) => String(user._id) === memberId);
        return found || (memberId === String(currentProfileId || "") ? { ...profile, _id: currentProfileId, displayName: profile?.displayName || "Me", avatarUrl: profile?.avatarUrl || "" } : { _id: memberId, displayName: "Member", avatarUrl: "" });
      })
    : [];
  const availableGroupMembers = isManagedGroup
    ? profiles.filter((user) => !(activeRoom?.participants || []).some((id) => String(id) === String(user._id)))
    : [];
  const activeRoomHasCall = Boolean(activeRoom?.activeCall);
  const currentCallRoomSlug = callRoomSlug || activeRoomSlug;
  const currentCallRoom = roomsSorted.find((room) => room.slug === currentCallRoomSlug) || activeRoom;
  const currentCallIsDirect = Boolean(currentCallRoom?.isDirect);
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
    if (room.isSaved || String(room.slug || "").startsWith("saved:")) return profile?.avatarUrl || "";
    if (room.isGroup) return room.groupAvatarUrl || "";
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
    return (call.callType || call.type) === "video" ? "Video call" : "Audio call";
  }

  function getCallHistoryDirection(call) {
    if (call?.direction === "outgoing" || call?.direction === "incoming") return call.direction;
    return String(call?.callerProfileId || "") === String(currentProfileId || "") ? "outgoing" : "incoming";
  }

  function getCallHistoryDayLabel(dateValue) {
    const date = new Date(dateValue || 0);
    if (Number.isNaN(date.getTime())) return "Earlier";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - target) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
    return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }

  const groupedCallHistory = useMemo(() => {
    const groups = [];
    (callHistory || []).forEach((call) => {
      const label = getCallHistoryDayLabel(call.startedAt);
      let group = groups.find((item) => item.label === label);
      if (!group) {
        group = { label, calls: [] };
        groups.push(group);
      }
      group.calls.push(call);
    });
    return groups;
  }, [callHistory]);

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
      if (!authToken) {
        setSession(null);
        setProfile(null);
        setAuthChecked(true);
        return;
      }
      try {
        const meRes = await authFetch(`${API_BASE}/api/auth/me`);
        const mePayload = await meRes.json();
        if (!meRes.ok || !mePayload.success) throw new Error(mePayload.error || "Your session has expired");
        const account = mePayload.data.profile;
        localStorage.setItem(ACCOUNT_INSTALL_ID_KEY, account.installId);
        setInstallId(account.installId);
        setSession(account);
        setProfile(account);
        setDisplayNameInput(account.displayName || "");
        setProfileStatusInput(account.profileStatus || "Available now");
      } catch (err) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(ACCOUNT_INSTALL_ID_KEY);
        setAuthToken("");
        setSession(null);
        setProfile(null);
        setError(err.message || "Please sign in again");
      } finally {
        setAuthChecked(true);
      }
    }
    init();
  }, [authToken]);

  function handleAuthenticated(data) {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(ACCOUNT_INSTALL_ID_KEY, data.profile.installId);
    setAuthToken(data.token);
    setInstallId(data.profile.installId);
    setSession(data.profile);
    setProfile(data.profile);
    setDisplayNameInput(data.profile.displayName || "");
    setProfileStatusInput(data.profile.profileStatus || "Available now");
    setAuthChecked(true);
  }

  async function checkAdminAccess({ openWhenAllowed = false } = {}) {
    setAdminAccessBusy(true);
    setAdminAccessCheck(null);
    try {
      const response = await authFetch("/api/admin/access");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to check admin access");
      }
      const data = payload.data || {};
      setAdminAccessCheck(data);
      if (data.allowed) {
        setProfile((current) => current ? { ...current, role: "admin" } : current);
        setSession((current) => current ? { ...current, role: "admin" } : current);
        if (openWhenAllowed) {
          setSidebarMode("settings");
          setShowSidebar(false);
          setShowAdminDashboard(true);
        }
      }
      return data;
    } catch (error) {
      setAdminAccessCheck({ allowed: false, message: error?.message || "Failed to check admin access" });
      return null;
    } finally {
      setAdminAccessBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_INSTALL_ID_KEY);
    setAuthToken("");
    setSession(null);
    setProfile(null);
    setRooms([]);
    setMessagesByRoom({});
    setActiveRoomSlug("");
  }



  useEffect(() => {
    if (!canChat || !installId) return;

    socket.emit("profile:register", {
      installId,
      profileId: currentProfileId || profile?.profileId || null,
    });
  }, [canChat, installId, currentProfileId, profile?.profileId]);

  useEffect(() => {
    if (!canChat || !installId) return;

    const rejoinActiveRoom = () => {
      socket.emit("profile:register", {
        installId,
        profileId: currentProfileId || profile?.profileId || null,
      });

      if (activeRoomSlugRef.current) {
        socket.emit("join_room", { roomSlug: activeRoomSlugRef.current, installId });
      }
    };

    socket.on("connect", rejoinActiveRoom);
    socket.io?.on?.("reconnect", rejoinActiveRoom);
    window.addEventListener("online", rejoinActiveRoom);

    return () => {
      socket.off("connect", rejoinActiveRoom);
      socket.io?.off?.("reconnect", rejoinActiveRoom);
      window.removeEventListener("online", rejoinActiveRoom);
    };
  }, [canChat, installId, currentProfileId, profile?.profileId]);

  useEffect(() => {
    if (!canChat) return;
    authFetch(`${API_BASE}/api/chat-preferences`)
      .then((res) => res.json().then((payload) => ({ res, payload })))
      .then(({ res, payload }) => {
        if (res.ok && payload?.success) setChatOrgPrefs(payload.data);
      })
      .catch(() => {});
  }, [canChat]);

  async function updateRoomPreference(roomSlug, action, enabled) {
    try {
      const res = await authFetch(`${API_BASE}/api/chat-preferences/${encodeURIComponent(roomSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, enabled }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to update chat preference");
      setChatOrgPrefs(payload.data);
      if (action === "archive" && enabled && activeRoomSlug === roomSlug) setActiveRoomSlug("");
    } catch (err) {
      setError(err.message || "Failed to update chat preference");
    }
  }

  useEffect(() => {
    if (!canChat) return;

    async function loadRoomsAndProfiles() {
      try {
        const [roomsRes, profilesRes, unreadRes] = await Promise.all([
          authFetch(`${API_BASE}/api/rooms`, { headers: { "x-install-id": installId } }),
          authFetch(`${API_BASE}/api/profiles`, { headers: { "x-install-id": installId } }),
          authFetch(`${API_BASE}/api/unread-counts`, { headers: { "x-install-id": installId } }),
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
    const onPresenceUpdated = ({ profileId } = {}) => {
      if (!profileId) return;
      // Presence is privacy-aware and must be re-shaped by the server for this viewer.
      loadRoomsAndProfiles();
    };
    const onUnreadCountsUpdated = (counts) => {
      const normalizedCounts = {};
      Object.entries(counts || {}).forEach(([roomSlug, count]) => {
        normalizedCounts[roomSlug] = Number(count || 0);
      });
      setUnreadCounts(normalizedCounts);
    };

    socket.on("rooms_updated", onRoomsUpdated);
    socket.on("profiles_updated", onProfilesUpdated);
    socket.on("presence_updated", onPresenceUpdated);
    socket.on("unread_counts_updated", onUnreadCountsUpdated);

    return () => {
      socket.off("rooms_updated", onRoomsUpdated);
      socket.off("profiles_updated", onProfilesUpdated);
      socket.off("presence_updated", onPresenceUpdated);
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
        const searchParams = new URLSearchParams({ q, installId, type: globalSearchType });
        if (globalSearchSender) searchParams.set("senderProfileId", globalSearchSender);
        if (globalSearchDateFrom) searchParams.set("from", globalSearchDateFrom);
        if (globalSearchDateTo) searchParams.set("to", globalSearchDateTo);
        const res = await authFetch(
          `${API_BASE}/api/messages/search?${searchParams.toString()}`,
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
  }, [canChat, sidebarMode, chatSearch, installId, globalSearchType, globalSearchSender, globalSearchDateFrom, globalSearchDateTo]);

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

    const handleEditedMessage = ({ roomSlug, message }) => {
      if (!roomSlug || !message?._id) return;
      setMessagesByRoom((current) => ({
        ...current,
        [roomSlug]: (current[roomSlug] || []).map((item) =>
          String(item._id) === String(message._id)
            ? { ...item, ...message, reactions: normalizeReactions(message.reactions) }
            : item.replyTo?.messageId && String(item.replyTo.messageId) === String(message._id)
              ? { ...item, replyTo: { ...item.replyTo, content: message.content } }
              : item
        ),
      }));
    };

    const handleHiddenMessage = ({ roomSlug, messageId }) => {
      if (!roomSlug || !messageId) return;
      setMessagesByRoom((current) => ({
        ...current,
        [roomSlug]: (current[roomSlug] || []).filter((item) => String(item._id) !== String(messageId)),
      }));
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
        setActiveRoomSlug(nextRoom?.slug || "");
        setShowChatDetails(false);
      }
    };

    const handleUserTyping = (payload) => {
      const payloadRoomSlug = typeof payload === "object" && payload !== null ? payload.roomSlug : activeRoomSlug;
      const payloadProfileId = typeof payload === "object" && payload !== null ? String(payload.profileId || "") : "";
      const payloadName = typeof payload === "object" && payload !== null ? payload.name : payload;

      if (payloadRoomSlug !== activeRoomSlug) return;
      if (payloadProfileId && payloadProfileId === String(currentProfileId || "")) return;

      setTypingName(payloadName || "");
      window.clearTimeout(remoteTypingTimeoutRef.current);
      remoteTypingTimeoutRef.current = window.setTimeout(() => setTypingName(""), 4500);
    };

    const handleUserStopTyping = (payload) => {
      const payloadRoomSlug = typeof payload === "object" && payload !== null ? payload.roomSlug : activeRoomSlug;
      const payloadProfileId = typeof payload === "object" && payload !== null ? String(payload.profileId || "") : "";

      if (payloadRoomSlug !== activeRoomSlug) return;
      if (payloadProfileId && payloadProfileId === String(currentProfileId || "")) return;

      window.clearTimeout(remoteTypingTimeoutRef.current);
      setTypingName("");
    };
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

    const handleMessageError = (payload) => {
      if (payload?.roomSlug && payload.roomSlug !== activeRoomSlug) return;
      setError(payload?.error || "Message could not be sent");
    };

    socket.on("load_messages", handleLoadMessages);
    socket.on("message:error", handleMessageError);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_deleted", handleDeletedMessage);
    socket.on("message_edited", handleEditedMessage);
    socket.on("message_hidden", handleHiddenMessage);
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
      socket.off("message:error", handleMessageError);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_deleted", handleDeletedMessage);
      socket.off("message_edited", handleEditedMessage);
      socket.off("message_hidden", handleHiddenMessage);
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
      window.clearTimeout(remoteTypingTimeoutRef.current);
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
    if (!canChat || !activeRoomSlug || !installId) return;

    async function refreshActiveRoomMessagesForMobile() {
      if (document.hidden) return;
      try {
        const res = await authFetch(`${API_BASE}/api/messages/${encodeURIComponent(activeRoomSlug)}`, {
          headers: { "x-install-id": installId },
        });
        const incoming = await res.json();
        if (!Array.isArray(incoming)) return;
        setMessagesByRoom((current) => ({
          ...current,
          [activeRoomSlug]: incoming.map((msg) => ({ ...msg, reactions: normalizeReactions(msg.reactions) })),
        }));
      } catch {
        // socket remains primary; this is only an iPhone/PWA resilience fallback
      }
    }

    const interval = window.setInterval(refreshActiveRoomMessagesForMobile, 5000);
    document.addEventListener("visibilitychange", refreshActiveRoomMessagesForMobile);
    window.addEventListener("focus", refreshActiveRoomMessagesForMobile);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshActiveRoomMessagesForMobile);
      window.removeEventListener("focus", refreshActiveRoomMessagesForMobile);
    };
  }, [activeRoomSlug, canChat, installId]);

  useEffect(() => {
    const handleCallError = (payload) => {
      setCallError(payload?.error || "Call could not be started");
      setInCall(false);
      setCallRoomSlug("");
      cleanupCallMedia();
    };
    socket.on("call:error", handleCallError);
    return () => socket.off("call:error", handleCallError);
  }, []);

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
        const res = await authFetch(`${API_BASE}/api/calls?installId=${encodeURIComponent(installId)}`, { headers: { "x-install-id": installId } });
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

  function scrollToMessage(messageId) {
    if (!messageId) return;
    const escapedId = typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(String(messageId))
      : String(messageId).replace(/["\\]/g, "\\$&");
    const node = document.querySelector(`[data-message-id="${escapedId}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSearchMessageId(String(messageId));
  }

  function markPlayed(messageId) {
    setListenedMap((current) => {
      if (current[messageId]) return current;
      return { ...current, [messageId]: true };
    });
  }

  async function handleSetName() {
    if (profileSavePending) return;

    const nextDisplayName = displayNameInput.trim();
    if (!nextDisplayName) {
      setProfileSaveError("Display name is required.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);

    try {
      setError("");
      setProfileSaveError("");
      setProfileSavePending(true);

      const formData = new FormData();
      formData.append("installId", installId);
      formData.append("displayName", nextDisplayName);
      formData.append("profileStatus", profileStatusInput.trim() || "Available now");

      if (profileAvatarFile) {
        const preparedImage = await prepareProfileImage(profileAvatarFile);
        if (preparedImage) formData.append("avatar", preparedImage, preparedImage.name);
      }

      const res = await authFetch(`${API_BASE}/api/profile`, {
        method: "POST",
        headers: { "x-install-id": installId },
        body: formData,
        signal: controller.signal,
      });

      const responseText = await res.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error("The server returned an invalid response while saving your profile.");
      }

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to save profile");
      }

      if (!payload.data) {
        throw new Error("The server returned an incomplete profile response.");
      }

      setSession((current) => ({ ...(current || {}), ...payload.data }));
      setProfile((current) => ({ ...(current || {}), ...payload.data }));
      setDisplayNameInput(payload.data.displayName || nextDisplayName);
      setProfileStatusInput(payload.data.profileStatus || "Available now");
      setProfileAvatarFile(null);
      setProfileAvatarPreview(payload.data.avatarUrl || "");
      setShowProfileEditor(false);
    } catch (err) {
      const message = err?.name === "AbortError"
        ? "The picture upload took too long. Check your connection and try again."
        : (err?.message || "Failed to save profile");
      setProfileSaveError(message);
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setProfileSavePending(false);
    }
  }

  async function updateContactPreference(targetProfileId, changes) {
    if (!targetProfileId) return;
    setContactManageBusyId(String(targetProfileId));
    setContactManageNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/contacts/${encodeURIComponent(targetProfileId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify(changes),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to update contact");
      setProfile((current) => current ? {
        ...current,
        savedContacts: payload.data?.savedContacts || current.savedContacts || [],
        favoriteContacts: payload.data?.favoriteContacts || current.favoriteContacts || [],
      } : current);
      setContactManageNotice("Contact updated.");
    } catch (err) {
      setError(err?.message || "Failed to update contact");
    } finally {
      setContactManageBusyId("");
    }
  }

  async function setContactBlocked(targetProfileId, shouldBlock) {
    if (!targetProfileId) return;
    const target = profiles.find((user) => String(user._id) === String(targetProfileId));
    if (shouldBlock && !window.confirm(`Block ${target?.displayName || "this contact"}? They will not be able to message or call you directly.`)) return;
    setContactManageBusyId(String(targetProfileId));
    setContactManageNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/contacts/${encodeURIComponent(targetProfileId)}/block`, {
        method: shouldBlock ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error || `Failed to ${shouldBlock ? "block" : "unblock"} contact`);
      setProfile((current) => current ? {
        ...current,
        blockedProfiles: payload.data?.blockedProfiles || current.blockedProfiles || [],
        favoriteContacts: payload.data?.favoriteContacts || current.favoriteContacts || [],
      } : current);
      setContactManageNotice(shouldBlock ? `${target?.displayName || "Contact"} blocked.` : `${target?.displayName || "Contact"} unblocked.`);
      if (shouldBlock && activeDirectContactId === String(targetProfileId)) {
        setMessageInput("");
        updateDraftForRoom(activeRoomSlug, "");
      }
    } catch (err) {
      setError(err?.message || `Failed to ${shouldBlock ? "block" : "unblock"} contact`);
    } finally {
      setContactManageBusyId("");
    }
  }

  async function startDirectRoom(targetProfileId) {
    try {
      setError("");
      const res = await authFetch(`${API_BASE}/api/direct-room`, {
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

  async function createGroup() {
    const name = newGroupName.trim();
    if (name.length < 2) {
      setError("Enter a group name with at least 2 characters.");
      return;
    }
    if (!newGroupMemberIds.length) {
      setError("Select at least one person for the group.");
      return;
    }
    setGroupManageBusy(true);
    setGroupManageNotice("");
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify({ name, participantIds: newGroupMemberIds }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to create group");
      const room = payload.data;
      setRooms((current) => [room, ...current.filter((item) => item.slug !== room.slug)]);
      setActiveRoomSlug(room.slug);
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupMemberIds([]);
      setSidebarMode("chats");
      setShowSidebar(false);
    } catch (err) {
      setError(err.message || "Failed to create group");
    } finally {
      setGroupManageBusy(false);
    }
  }

  function mergeUpdatedRoom(room) {
    if (!room?.slug) return;
    setRooms((current) => current.map((item) => item.slug === room.slug ? { ...item, ...room } : item));
  }

  async function updateGroupDetails({ name, avatarFile } = {}) {
    if (!activeRoom?.isGroup) return;
    setGroupManageBusy(true);
    setGroupManageNotice("");
    setError("");
    try {
      const form = new FormData();
      if (typeof name === "string") form.append("name", name.trim());
      if (avatarFile) form.append("avatar", avatarFile);
      const res = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(activeRoom.slug)}`, {
        method: "PATCH",
        headers: { "x-install-id": installId },
        body: form,
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to update group");
      mergeUpdatedRoom(payload.data);
      setGroupManageNotice("Group details updated.");
    } catch (err) {
      setError(err.message || "Failed to update group");
    } finally {
      setGroupManageBusy(false);
    }
  }

  async function addGroupMember(profileId) {
    if (!activeRoom?.isGroup || !profileId) return;
    setGroupManageBusy(true); setGroupManageNotice(""); setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(activeRoom.slug)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify({ profileId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to add member");
      mergeUpdatedRoom(payload.data); setGroupManageNotice("Member added.");
    } catch (err) { setError(err.message || "Failed to add member"); }
    finally { setGroupManageBusy(false); }
  }

  async function removeGroupMember(profileId) {
    if (!activeRoom?.isGroup || !profileId) return;
    if (!window.confirm("Remove this person from the group?")) return;
    setGroupManageBusy(true); setGroupManageNotice(""); setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(activeRoom.slug)}/members/${encodeURIComponent(profileId)}`, {
        method: "DELETE", headers: { "x-install-id": installId },
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to remove member");
      mergeUpdatedRoom(payload.data); setGroupManageNotice("Member removed.");
    } catch (err) { setError(err.message || "Failed to remove member"); }
    finally { setGroupManageBusy(false); }
  }

  async function setGroupAdmin(profileId, makeAdmin) {
    if (!activeRoom?.isGroup || !profileId) return;
    setGroupManageBusy(true); setGroupManageNotice(""); setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(activeRoom.slug)}/admins/${encodeURIComponent(profileId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify({ admin: makeAdmin }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to update admin role");
      mergeUpdatedRoom(payload.data); setGroupManageNotice(makeAdmin ? "Group admin added." : "Admin role removed.");
    } catch (err) { setError(err.message || "Failed to update admin role"); }
    finally { setGroupManageBusy(false); }
  }

  async function leaveActiveGroup() {
    if (!activeRoom?.isGroup) return;
    if (!window.confirm(`Leave ${activeRoom.name || "this group"}?`)) return;
    setGroupManageBusy(true); setError("");
    try {
      const res = await authFetch(`${API_BASE}/api/groups/${encodeURIComponent(activeRoom.slug)}/leave`, {
        method: "POST", headers: { "x-install-id": installId },
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to leave group");
      setRooms((current) => current.filter((item) => item.slug !== activeRoom.slug));
      setActiveRoomSlug(""); setShowChatDetails(false); setSidebarMode("chats");
    } catch (err) { setError(err.message || "Failed to leave group"); }
    finally { setGroupManageBusy(false); }
  }

  async function editMessage(message) {
    if (!message?._id || message.type !== "text" || message.isDeleted) return;
    const nextContent = window.prompt("Edit message", message.content || "");
    if (nextContent === null) return;
    const content = nextContent.trim();
    if (!content || content === String(message.content || "").trim()) return;
    try {
      setError("");
      await editMessageRequest(message._id, content, installId);
    } catch (err) {
      setError(err.message || "Failed to edit message");
    }
  }

  async function deleteMessageForMe(message) {
    if (!message?._id) return;
    if (!window.confirm("Delete this message for you?")) return;
    try {
      setError("");
      await deleteMessageRequest(message._id, "me", installId);
      setMessagesByRoom((current) => ({
        ...current,
        [message.roomSlug]: (current[message.roomSlug] || []).filter((item) => String(item._id) !== String(message._id)),
      }));
    } catch (err) {
      setError(err.message || "Failed to delete message");
    }
  }

  async function deleteMessageForEveryone(message) {
    if (!message?._id) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      setError("");
      await deleteMessageRequest(message._id, "everyone", installId);
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

  async function updateDisappearingMessages(seconds) {
    if (!activeRoomSlug) return;
    setDisappearingBusy(true);
    setDisappearingNotice("");
    try {
      const res = await authFetch(`${API_BASE}/api/rooms/${encodeURIComponent(activeRoomSlug)}/disappearing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify({ seconds, installId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.error || "Failed to update disappearing messages");
      const updated = payload.data;
      setRooms((current) => current.map((room) => room.slug === updated.slug ? { ...room, ...updated } : room));
      setDisappearingNotice(seconds ? `New messages will disappear after ${disappearingLabel(seconds)}.` : "Disappearing messages are off.");
    } catch (error) {
      setDisappearingNotice(error.message || "Failed to update disappearing messages");
    } finally {
      setDisappearingBusy(false);
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
      const res = await authFetch(`${API_BASE}/api/rooms/${encodeURIComponent(targetRoomSlug)}/messages`, {
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
      const res = await authFetch(
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
      const res = await authFetch(`${API_BASE}/api/messages/${messageId}/reactions`, {
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
      const res = await authFetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomSlug)}/hide`, {
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
        setActiveRoomSlug(nextRoom?.slug || "");
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
        if (getAuthToken()) xhr.setRequestHeader("Authorization", `Bearer ${getAuthToken()}`);

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

          let payload;
          try {
            payload = JSON.parse(xhr.responseText || "null");
          } catch {
            // The server response was not JSON; use the HTTP status fallback below.
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

  function updateDraftForRoom(roomSlug, value) {
    if (!roomSlug) return;
    setDraftsByRoom((current) => {
      const next = { ...current };
      if (String(value || "").trim()) next[roomSlug] = value;
      else delete next[roomSlug];
      saveDraftMap(currentProfileId, next);
      return next;
    });
  }

  async function loadScheduledMessages() {
    if (!currentProfileId) return;
    try {
      const response = await authFetch(`${API_BASE}/api/scheduled-messages`, {
        headers: { "x-install-id": installId },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Failed to load scheduled messages");
      setScheduledMessages(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      console.error("scheduled messages load error:", err);
    }
  }

  function openScheduleMessageDialog() {
    if (!activeRoomSlug) return;
    if (activeDirectContactBlocked) {
      setError("Unblock this contact before scheduling messages.");
      return;
    }
    setScheduleContent(messageInput || draftsByRoom[activeRoomSlug] || "");
    setScheduleAt(defaultScheduleInputValue());
    setScheduleNotice("");
    setShowScheduleMessage(true);
    setShowMobileChatMenu(false);
  }

  async function submitScheduledMessage() {
    const content = scheduleContent.trim();
    if (!activeRoomSlug || !content) {
      setScheduleNotice("Enter the message you want to schedule.");
      return;
    }
    const sendAtDate = new Date(scheduleAt);
    if (Number.isNaN(sendAtDate.getTime())) {
      setScheduleNotice("Choose a valid date and time.");
      return;
    }

    setScheduleBusy(true);
    setScheduleNotice("");
    try {
      const response = await authFetch(`${API_BASE}/api/scheduled-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-install-id": installId },
        body: JSON.stringify({
          roomSlug: activeRoomSlug,
          content,
          sendAt: sendAtDate.toISOString(),
          replyToMessageId: replyTo?._id || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Failed to schedule message");

      setScheduledMessages((current) => [...current.filter((item) => String(item._id) !== String(payload.data?._id)), payload.data].filter(Boolean).sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt)));
      updateDraftForRoom(activeRoomSlug, "");
      setReplyTo(null);
      setScheduleContent("");
      setShowScheduleMessage(false);
      setError("");
    } catch (err) {
      setScheduleNotice(err?.message || "Failed to schedule message");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function cancelScheduledMessage(scheduledMessageId) {
    if (!scheduledMessageId) return;
    if (!window.confirm("Cancel this scheduled message?")) return;
    try {
      const response = await authFetch(`${API_BASE}/api/scheduled-messages/${encodeURIComponent(scheduledMessageId)}`, {
        method: "DELETE",
        headers: { "x-install-id": installId },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Failed to cancel scheduled message");
      setScheduledMessages((current) => current.filter((item) => String(item._id) !== String(scheduledMessageId)));
    } catch (err) {
      setError(err?.message || "Failed to cancel scheduled message");
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
    if (activeDirectContactBlocked) {
      setError("Unblock this contact before sending messages.");
      return;
    }
    socket.emit("send_message", {
      roomSlug: activeRoomSlug,
      installId,
      content: messageInput.trim(),
      replyToMessageId: replyTo?._id || null,
    });
    setMessageInput("");
    updateDraftForRoom(activeRoomSlug, "");
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
    if (activeDirectContactBlocked) { setCallError("Unblock this contact before calling."); return; }
    enterCall(activeRoomHasCall ? "call:join" : "call:start", activeRoomSlugRef.current, "audio");
  }

  async function startVideoCall() {
    if (activeDirectContactBlocked) { setCallError("Unblock this contact before calling."); return; }
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
      const res = await authFetch(`${API_BASE}/api/messages/${message._id}/star`, {
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
      const res = await authFetch(`${API_BASE}/api/messages/${message._id}/pin`, {
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
        const res = await authFetch(`${API_BASE}/api/messages/${message._id}/forward`, {
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

  function openDesktopMessageMenu(message, position) {
    if (window.matchMedia("(max-width: 760px)").matches) return;
    const menuWidth = 286;
    const menuHeight = 430;
    const x = Math.min(Math.max(10, position.x), Math.max(10, window.innerWidth - menuWidth - 10));
    const y = Math.min(Math.max(10, position.y), Math.max(10, window.innerHeight - menuHeight - 10));
    setReactionPicker(null);
    setDesktopMessageActions({ message, position: { x, y } });
  }

  function startLongPressReaction(message, event) {
    window.clearTimeout(longPressTimerRef.current);
    const touch = event.touches?.[0];
    longPressTimerRef.current = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        if (navigator.vibrate) navigator.vibrate(18);
        setMobileMessageActions({ message });
        return;
      }
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowLaunchScreen(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return undefined;

    const handlePointerMove = (event) => {
      setDesktopSidebarWidth(Math.min(620, Math.max(440, event.clientX)));
    };
    const stopResizing = () => {
      setIsResizingSidebar(false);
      document.body.classList.remove("wa-resizing-sidebar");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing, { once: true });
    window.addEventListener("pointercancel", stopResizing, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_SIDEBAR_WIDTH_KEY, String(Math.round(desktopSidebarWidth)));
  }, [desktopSidebarWidth]);

  if (showLaunchScreen) {
    return (
      <>
        <StyleTag />
        <div className="wa-launch-screen" role="status" aria-label="Launching Int-Messager">
          <img src="/icons/icon-512.png" alt="Int-Messager" className="wa-launch-logo" />
          <div className="wa-launch-name">Int-Messager</div>
        </div>
      </>
    );
  }

  if (!authChecked) {
    return (<> <StyleTag /> <div className="wa-empty">Loading…</div> </>);
  }

  if (!authToken || !session) {
    return (
      <>
        <StyleTag />
        <AuthScreen onAuthenticated={handleAuthenticated} legacyInstallId={legacyInstallId} />
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

      <AdminDashboard
        open={showAdminDashboard}
        appearance={resolvedAppearance}
        onClose={() => {
          setShowAdminDashboard(false);
          setSidebarMode("settings");
          setShowSidebar(true);
        }}
      />

      {showScheduleMessage ? (
        <div className="wa-schedule-modal-backdrop" data-appearance={resolvedAppearance} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !scheduleBusy) setShowScheduleMessage(false); }}>
          <section className="wa-schedule-modal" role="dialog" aria-modal="true" aria-label="Schedule message">
            <div className="wa-schedule-modal-head">
              <div>
                <strong>Schedule message</strong>
                <small>{getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles) || "Conversation"}</small>
              </div>
              <button type="button" disabled={scheduleBusy} onClick={() => setShowScheduleMessage(false)} aria-label="Close">×</button>
            </div>
            <label className="wa-schedule-field">
              Message
              <textarea value={scheduleContent} onChange={(e) => setScheduleContent(e.target.value)} maxLength={4000} rows={5} placeholder="Write the message to send later" autoFocus />
              <small>{scheduleContent.length}/4000</small>
            </label>
            <label className="wa-schedule-field">
              Send on
              <input type="datetime-local" value={scheduleAt} min={defaultScheduleInputValue(1)} onChange={(e) => setScheduleAt(e.target.value)} />
            </label>
            {replyTo ? <div className="wa-schedule-reply-note">Replying to {replyTo.sender}: {compactDraftPreview(replyTo.fileName || replyTo.content, 72)}</div> : null}
            {scheduleNotice ? <div className="wa-schedule-notice">{scheduleNotice}</div> : null}
            <div className="wa-schedule-modal-actions">
              <button type="button" className="secondary" disabled={scheduleBusy} onClick={() => setShowScheduleMessage(false)}>Cancel</button>
              <button type="button" className="primary" disabled={scheduleBusy || !scheduleContent.trim() || !scheduleAt} onClick={submitScheduledMessage}>{scheduleBusy ? "Scheduling…" : "Schedule message"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {showCreateGroup ? (
        <div className="wa-group-modal-backdrop" data-appearance={resolvedAppearance} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateGroup(false); }}>
          <section className="wa-group-modal" role="dialog" aria-modal="true" aria-label="Create group">
            <div className="wa-group-modal-head">
              <div><strong>New group</strong><small>Choose a name and at least one member</small></div>
              <button type="button" onClick={() => setShowCreateGroup(false)} aria-label="Close">×</button>
            </div>
            <label className="wa-group-field">Group name
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={60} placeholder="e.g. Family & Friends" autoFocus />
            </label>
            <div className="wa-group-member-picker">
              <div className="wa-group-picker-title">Members <span>{newGroupMemberIds.length} selected</span></div>
              <div className="wa-group-picker-list">
                {profiles.filter((user) => String(user._id) !== String(currentProfileId || "")).map((user) => {
                  const selected = newGroupMemberIds.includes(String(user._id));
                  return (
                    <label key={user._id} className={`wa-group-picker-row ${selected ? "selected" : ""}`}>
                      <input type="checkbox" checked={selected} onChange={() => setNewGroupMemberIds((current) => selected ? current.filter((id) => id !== String(user._id)) : [...current, String(user._id)])} />
                      <Avatar label={user.displayName} src={user.avatarUrl} />
                      <span><strong>{user.displayName}</strong><small>{user.profileStatus || (user.online ? "Online" : "Available")}</small></span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="wa-group-modal-actions">
              <button type="button" className="secondary" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="button" className="primary" disabled={groupManageBusy || newGroupName.trim().length < 2 || !newGroupMemberIds.length} onClick={createGroup}>{groupManageBusy ? "Creating…" : "Create group"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {showSidebar && !showAdminDashboard ? <div className="wa-mobile-overlay" onClick={() => setShowSidebar(false)} /> : null}

      <div data-theme={chatPrefs.theme || "light-grey"} data-appearance={resolvedAppearance} className={`wa-app ${activeRoom ? "has-active-chat" : "no-active-chat"} bubble-${chatPrefs.bubbleShape} font-${chatPrefs.fontSize}`} style={{ "--app-color": activeAppTheme.app, "--accent-color": activeAppTheme.accent, "--chat-wallpaper": activeAppTheme.chat, "--chat-color": activeAppTheme.outgoing, "--theme-sidebar": activeAppTheme.sidebar, "--theme-surface": activeAppTheme.surface, "--theme-surface-2": activeAppTheme.surface2, "--theme-incoming": activeAppTheme.incoming, "--theme-outgoing": activeAppTheme.outgoing, "--theme-text": activeAppTheme.text, "--theme-muted": activeAppTheme.muted, "--theme-border": activeAppTheme.border, "--desktop-sidebar-width": `${desktopSidebarWidth}px` }}>
        <aside className={`wa-sidebar ${showSidebar ? "open" : ""}`}>
          <NavigationRail
            sidebarMode={sidebarMode}
            totalUnreadCount={totalUnreadCount}
            profile={profile}
            avatar={<Avatar label={profile.displayName} src={profile.avatarUrl} />}
            onHome={() => { setActiveRoomSlug(""); setShowChatDetails(false); }}
            onModeChange={setSidebarMode}
            onEditProfile={() => {
              setDisplayNameInput(profile.displayName || "");
              setProfileStatusInput(profile.profileStatus || "Available now");
              setProfileAvatarPreview(profile.avatarUrl || "");
              setShowProfileEditor(true);
            }}
          />
          <div className="wa-sidebar-panel">
          <div className="wa-brand"><img src="/icons/icon-192.png" alt="" /><span>Int-Messager</span><em>{sidebarMode}</em></div>

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
              Contacts
            </button>
            <button
              type="button"
              className={`wa-side-tab ${sidebarMode === "updates" ? "active" : ""}`}
              onClick={() => setSidebarMode("updates")}
            >
              Updates
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

          {sidebarMode !== "updates" ? (
            <input
              className="wa-search-input"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder={sidebarMode === "chats" ? "Search chats" : sidebarMode === "people" ? "Search contacts" : sidebarMode === "settings" ? "Personalize chat" : "Search calls"}
            />
          ) : null}

          {sidebarMode === "chats" && chatSearch.trim().length >= 2 ? (
            <div className="wa-global-search-results wa-advanced-search">
              <div className="wa-section-label">Search messages</div>
              <div className="wa-search-filter-tabs" role="tablist" aria-label="Search result type">
                {[
                  ["all", "All"],
                  ["messages", "Messages"],
                  ["media", "Media"],
                  ["links", "Links"],
                  ["docs", "Docs"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={globalSearchType === value ? "active" : ""}
                    onClick={() => setGlobalSearchType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="wa-search-filter-grid">
                <label>
                  <span>From</span>
                  <select value={globalSearchSender} onChange={(e) => setGlobalSearchSender(e.target.value)}>
                    <option value="">Anyone</option>
                    {profiles
                      .filter((user) => String(user._id || user.profileId || "") !== String(currentProfileId || ""))
                      .slice()
                      .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || "")))
                      .map((user) => (
                        <option key={user._id || user.profileId} value={user._id || user.profileId}>
                          {user.displayName || "User"}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>After</span>
                  <input type="date" value={globalSearchDateFrom} onChange={(e) => setGlobalSearchDateFrom(e.target.value)} />
                </label>
                <label>
                  <span>Before</span>
                  <input type="date" value={globalSearchDateTo} onChange={(e) => setGlobalSearchDateTo(e.target.value)} />
                </label>
                {(globalSearchType !== "all" || globalSearchSender || globalSearchDateFrom || globalSearchDateTo) ? (
                  <button
                    type="button"
                    className="wa-search-clear-filters"
                    onClick={() => {
                      setGlobalSearchType("all");
                      setGlobalSearchSender("");
                      setGlobalSearchDateFrom("");
                      setGlobalSearchDateTo("");
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <div className="wa-search-result-summary">
                {globalMessageSearchLoading ? "Searching…" : `${globalMessageResults.length} result${globalMessageResults.length === 1 ? "" : "s"}`}
              </div>
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
                      <div className="wa-search-result-meta">
                        <span className={`wa-search-type-chip ${result.category || result.type || "message"}`}>{result.categoryLabel || result.type || "Message"}</span>
                        <span className="wa-room-sub">{new Date(result.createdAt).toLocaleDateString()}</span>
                      </div>
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
              {rooms.find((room) => room.slug === roomContextMenu.roomSlug)?.isSaved ? (
                <button type="button" disabled title="Saved Messages always stays first">★ Saved Messages stays first</button>
              ) : (
                <button type="button" onClick={() => {
                  const slug = roomContextMenu.roomSlug;
                  const enabled = !(chatOrgPrefs.pinnedRooms || []).includes(slug);
                  closeRoomContextMenu(); updateRoomPreference(slug, "pin", enabled);
                }}>{(chatOrgPrefs.pinnedRooms || []).includes(roomContextMenu.roomSlug) ? "Unpin chat" : "Pin chat"}</button>
              )}
              <button type="button" onClick={() => {
                const slug = roomContextMenu.roomSlug;
                const enabled = !(chatOrgPrefs.archivedRooms || []).includes(slug);
                closeRoomContextMenu(); updateRoomPreference(slug, "archive", enabled);
              }}>{(chatOrgPrefs.archivedRooms || []).includes(roomContextMenu.roomSlug) ? "Restore chat" : "Archive chat"}</button>
              <button type="button" onClick={() => {
                const slug = roomContextMenu.roomSlug;
                const enabled = !(chatOrgPrefs.mutedRooms || []).includes(slug);
                closeRoomContextMenu(); updateRoomPreference(slug, "mute", enabled);
              }}>{(chatOrgPrefs.mutedRooms || []).includes(roomContextMenu.roomSlug) ? "Unmute notifications" : "Mute notifications"}</button>
              <button type="button" onClick={() => {
                const slug = roomContextMenu.roomSlug;
                closeRoomContextMenu(); updateRoomPreference(slug, "unread", true);
              }}>Mark as unread</button>
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
              <div className="wa-chat-list-heading">
                <div className="wa-section-label">{showArchivedChats ? "Archived chats" : "Chats"}</div>
                <button type="button" className="wa-archive-toggle" onClick={() => setShowArchivedChats((value) => !value)}>
                  {showArchivedChats ? "Back to chats" : `Archived (${(chatOrgPrefs.archivedRooms || []).length})`}
                </button>
              </div>
              {filteredRooms.map((room) => {
                const roomDraft = draftsByRoom[room.slug] || "";
                const scheduledCount = scheduledMessages.filter((item) => item.roomSlug === room.slug && ["pending", "processing"].includes(item.status)).length;
                return (
                <button
                  key={room.slug}
                  type="button"
                  className={`wa-room-card ${activeRoomSlug === room.slug ? "active" : ""} ${(chatOrgPrefs.pinnedRooms || []).includes(room.slug) ? "pinned" : ""} ${room.isSaved ? "saved-messages" : ""}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!room.isSaved) openRoomContextMenu(room, event);
                  }}
                  onTouchStart={(event) => {
                    roomLongPressTimerRef.current = window.setTimeout(() => {
                      if (room.isSaved) return;
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
                    if ((chatOrgPrefs.manuallyUnreadRooms || []).includes(room.slug)) {
                      updateRoomPreference(room.slug, "unread", false);
                    }
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

                      <span className="wa-room-flags">
                        {room.isSaved ? <span title="Saved Messages">⭐</span> : null}
                        {(chatOrgPrefs.pinnedRooms || []).includes(room.slug) ? <span title="Pinned">📌</span> : null}
                        {(chatOrgPrefs.mutedRooms || []).includes(room.slug) ? <span title="Muted">🔕</span> : null}
                        {scheduledCount ? <span className="wa-scheduled-room-flag" title={`${scheduledCount} scheduled message${scheduledCount === 1 ? "" : "s"}`}>🕒{scheduledCount > 1 ? scheduledCount : ""}</span> : null}
                      </span>
                      {room.activeCall ? <span className="wa-call-badge">Live call</span> : null}

                      {(unreadCounts[room.slug] || (chatOrgPrefs.manuallyUnreadRooms || []).includes(room.slug)) ? (
                        <span className="wa-unread-badge">{unreadCounts[room.slug] || "•"}</span>
                      ) : null}
                    </div>

                    <div
                      className="wa-room-sub"
                      style={{ fontWeight: unreadCounts[room.slug] ? 700 : 400 }}
                    >
                      {room.activeCall
                        ? `${room.activeCallParticipants?.length || 1} in voice call`
                        : roomDraft.trim()
                          ? <><span className="wa-draft-label">Draft:</span> {compactDraftPreview(roomDraft)}</>
                          : room.lastMessageText || (room.slug === "general" ? "Public room" : room.isSaved ? "Private notes" : room.isDirect ? "No messages yet" : "No messages yet")}
                    </div>
                  </div>
                </button>
                );
              })}
            </>
          ) : sidebarMode === "updates" ? (
            <StatusUpdates currentProfile={profile} />
          ) : sidebarMode === "calls" ? (
            <>
              <div className="wa-section-label">Calls</div>
              {groupedCallHistory.length ? groupedCallHistory.map((group) => (
                <section className="wa-call-history-group" key={group.label}>
                  <div className="wa-call-history-date">{group.label}</div>
                  {group.calls.map((call) => {
                    const direction = getCallHistoryDirection(call);
                    const isMissed = call.status === "missed";
                    const isRejected = call.status === "rejected";
                    const isVideo = (call.callType || call.type) === "video";
                    const displayName = getCallHistoryDisplayName(call);
                    return (
                      <button
                        key={call._id || `${call.roomSlug}-${call.startedAt}`}
                        type="button"
                        className={`wa-call-log-card wa-call-log-action ${isMissed ? "is-missed" : ""}`}
                        onClick={() => startCallFromHistory(call)}
                        title={`Call ${displayName} again`}
                      >
                        <Avatar label={displayName} src={call.otherUserAvatar || ""} />
                        <div className="wa-call-history-copy">
                          <div className="wa-room-row-top">
                            <div className="wa-room-title">{displayName}</div>
                            <span className={`wa-call-log-status ${isMissed ? "missed" : isRejected ? "rejected" : ""}`}>
                              {isMissed ? "Missed" : isRejected ? "Declined" : "Answered"}
                            </span>
                          </div>
                          <div className="wa-call-history-meta">
                            <span className={`wa-call-direction ${direction}`}>{direction === "outgoing" ? "↗" : "↙"}</span>
                            <span>{direction === "outgoing" ? "Outgoing" : "Incoming"}</span>
                            <span>·</span>
                            <span>{isVideo ? "Video" : "Audio"}</span>
                            <span>·</span>
                            <span>{new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {!isMissed && !isRejected && Number(call.durationSeconds || 0) > 0 ? (
                              <>
                                <span>·</span>
                                <span>{formatCallDuration(call.durationSeconds || 0)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span className="wa-call-history-redial" aria-hidden="true">{isVideo ? "📹" : "📞︎"}</span>
                      </button>
                    );
                  })}
                </section>
              )) : <div className="wa-empty dark">No call history yet.</div>}
            </>
          ) : sidebarMode === "settings" ? (
            <>
              <div className="wa-section-label">Account</div>
              <div className="wa-settings-card v4-account-card">
                <div className="v42-profile-summary">
                  <Avatar label={profile?.displayName || "Profile"} src={profile?.avatarUrl} className="large" />
                  <div className="v42-profile-summary-copy">
                    <div className="wa-settings-title">{profile?.displayName}</div>
                    <div className="wa-settings-note">{profile?.email || profile?.phone || "Signed-in account"}</div>
                    <div className="wa-settings-note">{profile?.profileStatus || "Available now"}</div>
                  </div>
                </div>
                <button className="wa-settings-btn v42-edit-profile-btn" type="button" onClick={() => {
                  setDisplayNameInput(profile?.displayName || "");
                  setProfileStatusInput(profile?.profileStatus || "Available now");
                  setProfileAvatarPreview(profile?.avatarUrl || "");
                  setProfileAvatarFile(null);
                  setProfileSaveError("");
                  setShowProfileEditor(true);
                }}>Change profile picture and details</button>
                <div className="wa-settings-note">This profile is synced and can be recovered by signing in on another device.</div>
                <button className="wa-settings-btn v4-logout-btn" type="button" onClick={handleLogout}>Sign out on this device</button>
              </div>
              {profile?.role === "admin" ? (
                <>
                  <div className="wa-section-label">Administration</div>
                  <div className="wa-settings-card admin-access-card">
                    <div className="wa-settings-title">Admin Dashboard</div>
                    <div className="wa-settings-note">View registered users, account activity and active sessions. Suspend access, send password resets, or sign a user out across devices.</div>
                    <button
                      className="wa-settings-btn admin-launch-btn"
                      type="button"
                      onClick={() => {
                        setSidebarMode("settings");
                        setShowSidebar(false);
                        setShowAdminDashboard(true);
                      }}
                    >
                      Open Admin Dashboard
                    </button>
                  </div>
                </>
              ) : null}
              <div className="wa-section-label">Security</div>
              <DeviceSessions />
              <div className="wa-section-label">Privacy</div>
              <div className="wa-settings-card wa-privacy-card">
                <div className="wa-settings-title">Privacy</div>
                <div className="wa-settings-note">Choose what other people can see. “My contacts” means people you have saved in Int-Messager.</div>

                <label className="wa-privacy-row">
                  <span><strong>Last seen</strong><small>Who can see when you were last active.</small></span>
                  <select value={privacySettings.lastSeenPrivacy} disabled={privacyBusy} onChange={(e) => updatePrivacySetting("lastSeenPrivacy", e.target.value)}>
                    <option value="everyone">Everyone</option>
                    <option value="contacts">My contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </label>

                <label className="wa-privacy-row">
                  <span><strong>Online status</strong><small>Control who can see when you are online.</small></span>
                  <select value={privacySettings.onlinePrivacy} disabled={privacyBusy} onChange={(e) => updatePrivacySetting("onlinePrivacy", e.target.value)}>
                    <option value="everyone">Everyone</option>
                    <option value="same_as_last_seen">Same as last seen</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </label>

                <label className="wa-privacy-row">
                  <span><strong>Profile photo</strong><small>Who can see your current profile picture.</small></span>
                  <select value={privacySettings.profilePhotoPrivacy} disabled={privacyBusy} onChange={(e) => updatePrivacySetting("profilePhotoPrivacy", e.target.value)}>
                    <option value="everyone">Everyone</option>
                    <option value="contacts">My contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </label>

                <label className="wa-privacy-toggle">
                  <span><strong>Read receipts</strong><small>Allow blue seen receipts in direct chats. Group read state remains enabled.</small></span>
                  <input type="checkbox" checked={privacySettings.readReceipts !== false} disabled={privacyBusy} onChange={(e) => updatePrivacySetting("readReceipts", e.target.checked)} />
                </label>

                {privacyNotice ? <div className="wa-privacy-notice">{privacyNotice}</div> : null}
              </div>
              <div className="wa-section-label">Blocked contacts</div>
              <div className="wa-settings-card wa-blocked-contacts-card">
                <div className="wa-settings-title">Blocked contacts</div>
                <div className="wa-settings-note">Blocked people cannot message or call you directly. Group membership is unchanged.</div>
                {blockedProfiles.length ? (
                  <div className="wa-blocked-list">
                    {blockedProfiles.map((user) => (
                      <div key={user._id} className="wa-blocked-row">
                        <Avatar label={user.displayName} src={user.avatarUrl} />
                        <div><strong>{user.displayName}</strong><small>{user.profileStatus || "Blocked contact"}</small></div>
                        <button type="button" disabled={contactManageBusyId === String(user._id)} onClick={() => setContactBlocked(user._id, false)}>Unblock</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="wa-empty">No blocked contacts.</div>}
              </div>
              <div className="wa-section-label">Chat view</div>
              <div className="wa-settings-card">
                <div className="wa-settings-title">Personalize this device</div>
                <button className="wa-settings-btn" type="button" onClick={requestBrowserNotifications}>Enable call/message notifications</button>
                <div className="wa-settings-note">Allows call and message alerts while this app is minimized, in another tab, or behind another window.</div>
                <label className="wa-settings-label archive-behaviour-setting">
                  <span>Keep archived chats archived when new messages arrive</span>
                  <input type="checkbox" checked={chatOrgPrefs.keepArchivedOnNewMessage !== false} onChange={(event) => updateArchiveBehaviour(event.target.checked)} />
                </label>
                <div className="wa-appearance-setting">
                  <div>
                    <div className="wa-settings-title">Appearance</div>
                    <div className="wa-settings-note">Choose light mode, dark mode, or follow this device automatically.</div>
                  </div>
                  <div className="wa-appearance-segmented" role="group" aria-label="App appearance">
                    {["light", "dark", "system"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={appearanceMode === mode ? "active" : ""}
                        aria-pressed={appearanceMode === mode}
                        onClick={() => setAppearanceMode(mode)}
                      >
                        {mode === "light" ? "☀ Light" : mode === "dark" ? "◐ Dark" : "◉ System"}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="wa-settings-label">App theme
                  <select className="wa-select" value={chatPrefs.theme || "light-grey"} onChange={(e) => updateChatPref("theme", e.target.value)}>
                    {Object.entries(APP_THEME_PRESETS).map(([value, preset]) => (
                      <option key={value} value={value}>{preset.label}</option>
                    ))}
                  </select>
                  <span className="wa-settings-note">This theme now controls the entire app, including navigation, settings, chat background, cards, bubbles and accent colours.</span>
                </label>
                <label className="wa-settings-label">Bubble style <select className="wa-select" value={chatPrefs.bubbleShape} onChange={(e) => updateChatPref("bubbleShape", e.target.value)}><option value="rounded">Rounded</option><option value="soft">Soft</option><option value="square">Compact square</option></select></label>
                <label className="wa-settings-label">Font size <select className="wa-select" value={chatPrefs.fontSize} onChange={(e) => updateChatPref("fontSize", e.target.value)}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></label>
              </div>
              <div className="wa-section-label">Developer tools</div>
              <div className="wa-settings-card developer-tools-card">
                <div className="wa-settings-title">Diagnostics</div>
                <div className="wa-settings-note">Use these tools while developing or troubleshooting the PWA.</div>
                <button className="wa-settings-btn" type="button" onClick={runDeveloperHealthCheck}>Run health check</button>
                <button className="wa-settings-btn" type="button" onClick={() => { socket.emit("rooms_updated"); setDeveloperStatus("Sync requested."); }}>Force data refresh</button>
                <button className="wa-settings-btn danger" type="button" onClick={resetDeveloperCache}>Clear cache and reset service worker</button>
                {developerStatus ? <div className="developer-status">{developerStatus}</div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="wa-contacts-heading">
                <div><div className="wa-section-label">Contacts</div><small>{savedContactIds.size} saved · {favoriteContactIds.size} favourites</small></div>
              </div>
              {contactManageNotice ? <div className="wa-contact-notice">{contactManageNotice}</div> : null}
              {[
                ["Favourites", favoriteProfiles],
                ["Saved contacts", savedProfiles],
                ["People on Int-Messager", otherProfiles],
              ].map(([label, list]) => list.length ? (
                <section className="wa-contact-section" key={label}>
                  <div className="wa-contact-section-title">{label}</div>
                  {list.map((user) => {
                    const userId = String(user._id);
                    const saved = savedContactIds.has(userId);
                    const favorite = favoriteContactIds.has(userId);
                    return (
                      <div key={userId} className="wa-contact-card">
                        <button type="button" className="wa-contact-main" onClick={() => startDirectRoom(user._id)}>
                          <Avatar label={user.displayName} src={user.avatarUrl} />
                          <span className="wa-user-content"><span className="wa-user-name">{user.displayName}</span><span className="wa-user-sub">{user.online ? "Online" : user.profileStatus || "Available now"}</span></span>
                        </button>
                        <div className="wa-contact-actions">
                          <button type="button" title={saved ? "Remove from saved contacts" : "Save contact"} disabled={contactManageBusyId === userId} onClick={() => updateContactPreference(userId, { saved: !saved })}>{saved ? "✓ Saved" : "+ Save"}</button>
                          <button type="button" title={favorite ? "Remove favourite" : "Add favourite"} disabled={contactManageBusyId === userId} onClick={() => updateContactPreference(userId, { favorite: !favorite })}>{favorite ? "★" : "☆"}</button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ) : null)}
              {!favoriteProfiles.length && !savedProfiles.length && !otherProfiles.length ? <div className="wa-empty dark">No contacts match your search.</div> : null}
            </>
          )}
          </div>
        </aside>

        <button
          type="button"
          className={`wa-desktop-resizer ${isResizingSidebar ? "active" : ""}`}
          aria-label="Resize navigation and settings panel"
          title="Drag to resize panel. Double-click to reset."
          onPointerDown={(event) => {
            if (window.innerWidth <= 900) return;
            event.preventDefault();
            setIsResizingSidebar(true);
            document.body.classList.add("wa-resizing-sidebar");
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onDoubleClick={() => setDesktopSidebarWidth(520)}
        />

        <section className="wa-main">
          <header className="wa-header">
            <div className="wa-header-left">
              <button
                type="button"
                className="wa-icon-btn wa-desktop-menu-btn"
                onClick={() => setShowSidebar((v) => !v)}
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                ☰
              </button>

              {activeRoom ? (
                <button
                  type="button"
                  className="wa-icon-btn wa-mobile-back-btn"
                  onClick={() => {
                    setActiveRoomSlug("");
                    setReplyTo(null);
                    setShowChatDetails(false);
                    setShowMessageSearch(false);
                    setShowMobileChatMenu(false);
                    setSidebarMode("chats");
                    setShowSidebar(false);
                  }}
                  title="Back to chats"
                  aria-label="Back to chats"
                >
                  ←
                </button>
              ) : null}

              {activeRoom ? (
                <>
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
                            : activeRoom.isDirect
                              ? formatPresenceLabel(activeRoomOtherProfile)
                              : "Group chat"}
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <img src="/icons/icon-192.png" alt="Int-Messager" className="wa-header-app-logo" />
                  <div className="wa-header-title-wrap">
                    <div className="wa-header-title">Int-Messager</div>
                    <div className="wa-header-sub">Connecting with love</div>
                  </div>
                </>
              )}
            </div>

            {activeRoom ? (
              <div className="wa-header-right">
              <button
                type="button"
                className={`wa-icon-btn call-action `}
                onClick={inCall ? () => joinCall() : startCall}
                title={inCall ? "Open call" : activeRoomHasCall ? "Join call" : "Start audio call"}
              >
                {activeRoomHasCall && !inCall ? "Join" : <span className="wa-call-icon wa-voice-call-icon" aria-hidden="true">📞︎</span>}
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
                className="wa-icon-btn wa-header-export-btn"
                onClick={() => exportChat("txt")}
                title="Export chat as text"
              >
                ⬇
              </button>

              <button
                type="button"
                className="wa-icon-btn wa-header-search-btn"
                onClick={() => setShowMessageSearch((v) => !v)}
                title="Search messages"
              >
                🔍
              </button>

              <button
                type="button"
                className="wa-icon-btn wa-close-chat-btn"
                onClick={() => {
                  setActiveRoomSlug("");
                  setReplyTo(null);
                  setShowChatDetails(false);
                  setShowMessageSearch(false);
                  setShowMobileChatMenu(false);
                  setSidebarMode("chats");
                  setShowSidebar(false);
                }}
                title="Close chat"
                aria-label="Close chat"
              >
                ✕
              </button>

              <button
                type="button"
                className="wa-icon-btn wa-mobile-chat-more-btn"
                onClick={() => setShowMobileChatMenu((value) => !value)}
                title="More chat options"
                aria-label="More chat options"
                aria-expanded={showMobileChatMenu}
              >
                ⋮
              </button>

              {showMobileChatMenu ? (
                <>
                  <button
                    type="button"
                    className="wa-mobile-chat-menu-backdrop"
                    aria-label="Close chat menu"
                    onClick={() => setShowMobileChatMenu(false)}
                  />
                  <div className="wa-mobile-chat-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setShowMobileChatMenu(false); setShowChatDetails(true); }}>
                      Chat info
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setShowMobileChatMenu(false); setShowMessageSearch(true); }}>
                      Search
                    </button>
                    <button type="button" role="menuitem" onClick={openScheduleMessageDialog}>
                      Schedule message
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setShowMobileChatMenu(false); exportChat("txt"); }}>
                      Export chat
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={() => {
                      setShowMobileChatMenu(false);
                      setActiveRoomSlug("");
                      setReplyTo(null);
                      setShowChatDetails(false);
                      setShowMessageSearch(false);
                      setSidebarMode("chats");
                      setShowSidebar(false);
                    }}>
                      Close chat
                    </button>
                  </div>
                </>
              ) : null}
              </div>
            ) : null}
          </header>

          {activeRoom && showMessageSearch ? (
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

          {activeRoom ? (
            <>
            <ConversationView
              messageArea={(
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

            <MessageList
              groupedMessages={groupedMessages}
              renderMessage={(message, index, sequence) => (
                <MessageBubble
                  key={message._id || `${message.createdAt}-${index}`}
                  message={message}
                  highlightedMessageId={highlightedSearchMessageId}
                  currentProfileId={currentProfileId}
                  activeAudioId={activeAudioId}
                  setActiveAudioId={setActiveAudioId}
                  listenedMap={listenedMap}
                  markPlayed={markPlayed}
                  onReply={setReplyTo}
                  onEdit={editMessage}
                  onDeleteForMe={deleteMessageForMe}
                  onDeleteForEveryone={deleteMessageForEveryone}
                  onScrollToReply={scrollToMessage}
                  onOpenDesktopMenu={openDesktopMessageMenu}
                  onStartLongPressReaction={startLongPressReaction}
                  onCancelLongPressReaction={cancelLongPressReaction}
                  onReact={reactToMessage}
                  onForward={forwardMessage}
                  onToggleStar={toggleStarMessage}
                  onTogglePin={togglePinMessage}
                  isGroupChat={isGroupChat}
                  isSequenceStart={sequence?.isSequenceStart}
                  isSequenceEnd={sequence?.isSequenceEnd}
                  getProfileNameById={getProfileNameById}
                  getProfileAvatarById={getProfileAvatarById}
                />
              )}
            />

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
              )}
              composer={(
          <Composer>
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
                  const nextValue = e.target.value;
                  setMessageInput(nextValue);
                  updateDraftForRoom(activeRoomSlug, nextValue);
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
          </Composer>
              )}
            />
              {showChatDetails ? (
                <>
                  <button
                    type="button"
                    className="wa-details-overlay"
                    aria-label="Close chat details"
                    onClick={() => setShowChatDetails(false)}
                  />
            <aside className="wa-details-page" aria-label="Chat details">
              <div className="wa-details-topbar">
                <button type="button" className="wa-details-back" onClick={() => setShowChatDetails(false)} title="Back to chat">← Back</button>
                <strong>Chat details</strong>
              </div>
              <section className="wa-details-hero">
                <Avatar label={getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(activeRoom)} className="details" />
                <h2>{getRoomDisplayName(activeRoom, profile?.displayName, currentProfileId, profiles)}</h2>
                <p>{activeRoom?.isDirect ? formatPresenceLabel(activeRoomOtherProfile) : activeRoom?.isGroup ? `${activeRoom.participants?.length || 0} members` : "General group chat"}</p>
              </section>

              <section className="wa-details-actions">
                <button type="button" onClick={startCall}><span className="wa-voice-call-icon" aria-hidden="true">📞︎</span> Audio call</button>
                <button type="button" onClick={startVideoCall}>📹 Video call</button>
                <button type="button" onClick={() => setShowMessageSearch(true)}>🔍 Search</button>
                <button type="button" onClick={openScheduleMessageDialog}>🕒 Schedule</button>
                <button type="button" onClick={() => exportChat("txt")}>⬇ Export TXT</button>
                <button type="button" onClick={() => exportChat("json")}>⬇ Export JSON</button>
                <button type="button" onClick={() => clearChatHistory()}>Clear history</button>
              </section>

              {activeRoom?.isDirect && !activeRoom?.isSaved && activeRoomOtherProfile ? (
                <section className="wa-details-card wa-contact-management-card">
                  <div className="wa-details-card-title">Contact</div>
                  <div className="wa-contact-detail-actions">
                    <button type="button" disabled={contactManageBusyId === activeDirectContactId} onClick={() => updateContactPreference(activeDirectContactId, { saved: !activeDirectContactSaved })}>{activeDirectContactSaved ? "✓ Saved contact" : "+ Save contact"}</button>
                    <button type="button" disabled={contactManageBusyId === activeDirectContactId} onClick={() => updateContactPreference(activeDirectContactId, { favorite: !activeDirectContactFavorite })}>{activeDirectContactFavorite ? "★ Favourite" : "☆ Add favourite"}</button>
                    <button type="button" className={activeDirectContactBlocked ? "" : "danger"} disabled={contactManageBusyId === activeDirectContactId} onClick={() => setContactBlocked(activeDirectContactId, !activeDirectContactBlocked)}>{activeDirectContactBlocked ? "Unblock contact" : "Block contact"}</button>
                  </div>
                  {activeDirectContactBlocked ? <div className="wa-contact-blocked-banner">This contact is blocked. Direct messages, files and calls are disabled until you unblock them.</div> : null}
                </section>
              ) : null}

              {activeRoom?.isGroup ? (
                <section className="wa-details-card wa-group-management-card">
                  <div className="wa-group-section-heading">
                    <div><div className="wa-details-card-title">Group management</div><small>{activeRoom.participants?.length || 0} members · {currentUserIsGroupOwner ? "You are the owner" : currentUserIsGroupAdmin ? "You are an admin" : "Member"}</small></div>
                  </div>

                  {currentUserIsGroupAdmin ? (
                    <div className="wa-group-edit-grid">
                      <label className="wa-group-field">Group name
                        <div className="wa-group-inline-edit">
                          <input defaultValue={activeRoom.name || ""} key={`group-name-${activeRoom.slug}-${activeRoom.name}`} id="wa-group-name-input" maxLength={60} />
                          <button type="button" disabled={groupManageBusy} onClick={() => updateGroupDetails({ name: document.getElementById("wa-group-name-input")?.value || activeRoom.name })}>Save</button>
                        </div>
                      </label>
                      <label className="wa-group-photo-control">Change group photo
                        <input type="file" accept="image/*" disabled={groupManageBusy} onChange={(e) => { const file = e.target.files?.[0]; if (file) updateGroupDetails({ avatarFile: file }); e.target.value = ""; }} />
                      </label>
                    </div>
                  ) : null}

                  {currentUserIsGroupAdmin && availableGroupMembers.length ? (
                    <div className="wa-group-add-row">
                      <select id="wa-group-add-select" defaultValue="">
                        <option value="" disabled>Add someone…</option>
                        {availableGroupMembers.map((user) => <option key={user._id} value={user._id}>{user.displayName}</option>)}
                      </select>
                      <button type="button" disabled={groupManageBusy} onClick={() => { const el = document.getElementById("wa-group-add-select"); if (el?.value) addGroupMember(el.value); }}>Add member</button>
                    </div>
                  ) : null}

                  {groupManageNotice ? <div className="wa-group-notice">{groupManageNotice}</div> : null}

                  <div className="wa-group-member-list">
                    {activeGroupMembers.map((member) => {
                      const memberId = String(member._id || "");
                      const isOwner = String(activeRoom.ownerProfileId || "") === memberId;
                      const isAdmin = isOwner || (activeRoom.groupAdmins || []).some((id) => String(id) === memberId);
                      const isMe = memberId === String(currentProfileId || "");
                      return (
                        <div key={memberId} className="wa-group-member-row">
                          <Avatar label={member.displayName || "Member"} src={member.avatarUrl || ""} />
                          <div className="wa-group-member-copy"><strong>{isMe ? `${member.displayName || "Me"} (You)` : member.displayName || "Member"}</strong><small>{isOwner ? "Group owner" : isAdmin ? "Group admin" : member.profileStatus || "Member"}</small></div>
                          <div className="wa-group-member-actions">
                            {currentUserIsGroupOwner && !isOwner && !isMe ? <button type="button" onClick={() => setGroupAdmin(memberId, !isAdmin)} disabled={groupManageBusy}>{isAdmin ? "Remove admin" : "Make admin"}</button> : null}
                            {currentUserIsGroupAdmin && !isOwner && !isMe ? <button type="button" className="danger" onClick={() => removeGroupMember(memberId)} disabled={groupManageBusy}>Remove</button> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button type="button" className="wa-group-leave-btn" disabled={groupManageBusy} onClick={leaveActiveGroup}>Leave group</button>
                </section>
              ) : null}

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

              <section className="wa-details-card wa-shared-content-card">
                <div className="wa-shared-content-heading">
                  <div>
                    <div className="wa-details-card-title">Media, links & docs</div>
                    <small>Everything shared in this conversation, organised by type.</small>
                  </div>
                  <span className="wa-shared-total">{activeRoomSharedContent.media.length + activeRoomSharedContent.docs.length + activeRoomSharedContent.links.length + activeRoomSharedContent.voice.length}</span>
                </div>

                <div className="wa-shared-tabs" role="tablist" aria-label="Shared content types">
                  {[
                    ["media", "Media", activeRoomSharedContent.media.length],
                    ["links", "Links", activeRoomSharedContent.links.length],
                    ["docs", "Docs", activeRoomSharedContent.docs.length],
                    ["voice", "Voice", activeRoomSharedContent.voice.length],
                  ].map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={sharedContentTab === key}
                      className={sharedContentTab === key ? "active" : ""}
                      onClick={() => setSharedContentTab(key)}
                    >
                      {label}<span>{count}</span>
                    </button>
                  ))}
                </div>

                {!activeSharedContentItems.length ? (
                  <div className="wa-shared-empty">No {sharedContentTab === "voice" ? "voice notes" : sharedContentTab} shared yet.</div>
                ) : sharedContentTab === "media" ? (
                  <div className="wa-shared-media-grid">
                    {activeSharedContentItems.map((message) => {
                      const href = resolveMediaUrl(message.fileUrl);
                      return (
                        <a key={message._id} href={href} target="_blank" rel="noreferrer" className="wa-shared-media-tile">
                          {isImageAttachment(message) ? (
                            <img src={href} alt={message.fileName || "Shared image"} loading="lazy" />
                          ) : (
                            <div className="wa-shared-video-placeholder"><span>▶</span><small>{message.fileName || "Video"}</small></div>
                          )}
                          <div className="wa-shared-media-meta">{formatSharedItemDate(message.createdAt)}</div>
                        </a>
                      );
                    })}
                  </div>
                ) : sharedContentTab === "links" ? (
                  <div className="wa-shared-list">
                    {activeSharedContentItems.map((item) => {
                      let host = item.url;
                      try { host = new URL(item.url).hostname.replace(/^www\./, ""); } catch {}
                      return (
                        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="wa-shared-row wa-shared-link-row">
                          <span className="wa-shared-icon">🔗</span>
                          <span className="wa-shared-copy"><strong>{host}</strong><small>{item.url}</small><em>{item.sender} · {formatSharedItemDate(item.createdAt)}</em></span>
                          <span className="wa-shared-open">↗</span>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="wa-shared-list">
                    {activeSharedContentItems.map((message) => (
                      <a key={message._id} href={resolveMediaUrl(message.fileUrl)} target="_blank" rel="noreferrer" className="wa-shared-row">
                        <span className="wa-shared-icon">{sharedContentTab === "voice" ? "🎤" : isPdfAttachment(message) ? "PDF" : "📄"}</span>
                        <span className="wa-shared-copy">
                          <strong>{message.fileName || (sharedContentTab === "voice" ? "Voice note" : "Document")}</strong>
                          <small>{sharedContentTab === "voice" ? "Voice note" : getFileKindLabel(message)}</small>
                          <em>{message.sender || "User"} · {formatSharedItemDate(message.createdAt)}</em>
                        </span>
                        <span className="wa-shared-open">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className="wa-details-card wa-disappearing-card">
                <div className="wa-details-card-title">Disappearing messages</div>
                <div className="wa-disappearing-copy">New messages sent after this setting is changed will automatically disappear for everyone after the selected period.</div>
                <label className="wa-disappearing-select-row">
                  <span>Message timer</span>
                  <select
                    value={Number(activeRoom?.disappearingSeconds || 0)}
                    disabled={disappearingBusy || (activeRoom?.isGroup && !currentUserIsGroupAdmin) || (activeRoomSlug === "general" && profile?.role !== "admin")}
                    onChange={(event) => updateDisappearingMessages(Number(event.target.value))}
                  >
                    <option value={0}>Off</option>
                    <option value={86400}>24 hours</option>
                    <option value={604800}>7 days</option>
                    <option value={7776000}>90 days</option>
                  </select>
                </label>
                <div className="wa-disappearing-status">Current setting: <strong>{disappearingLabel(activeRoom?.disappearingSeconds)}</strong></div>
                {activeRoom?.isGroup && !currentUserIsGroupAdmin ? <small>Only group admins can change this setting.</small> : null}
                {activeRoomSlug === "general" && profile?.role !== "admin" ? <small>Only an Int-Messager administrator can change this setting for General.</small> : null}
                {disappearingNotice ? <div className="wa-disappearing-notice">{disappearingNotice}</div> : null}
              </section>

              <section className="wa-details-card wa-scheduled-card">
                <div className="wa-scheduled-card-head">
                  <div>
                    <div className="wa-details-card-title">Scheduled messages</div>
                    <small>Messages waiting to be sent from this chat.</small>
                  </div>
                  <button type="button" className="wa-scheduled-add-btn" onClick={openScheduleMessageDialog}>+ Schedule</button>
                </div>
                {scheduledMessages.filter((item) => item.roomSlug === activeRoomSlug && ["pending", "processing"].includes(item.status)).length ? (
                  <div className="wa-scheduled-list">
                    {scheduledMessages.filter((item) => item.roomSlug === activeRoomSlug && ["pending", "processing"].includes(item.status)).map((item) => (
                      <div className="wa-scheduled-item" key={item._id}>
                        <div className="wa-scheduled-item-copy">
                          <strong>{compactDraftPreview(item.content, 90)}</strong>
                          <small>{item.status === "processing" ? "Sending now…" : `Sends ${formatScheduledMessageTime(item.sendAt)}`}</small>
                        </div>
                        <button type="button" disabled={item.status === "processing"} onClick={() => cancelScheduledMessage(item._id)}>Cancel</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="wa-scheduled-empty">No scheduled messages in this chat.</div>}
              </section>

              <section className="wa-details-card danger-zone">
                <div className="wa-details-card-title">Chat management</div>
                <button type="button" className="wa-danger-text-btn" onClick={() => clearChatHistory()}>Clear history for me</button>
                <button type="button" className="wa-danger-text-btn" onClick={() => hideChatForMe(activeRoomSlug)}>Delete chat from my list</button>
              </section>
            </aside>
                </>
              ) : null}
            </>
          ) : (
            <main className="wa-welcome-screen">
              <div className="wa-welcome-content">
                <img src="/icons/icon-192.png" alt="Int-Messager" className="wa-welcome-logo" />
                <h1>Int-Messager</h1>
                <p className="wa-welcome-tagline">Connecting with love</p>
                <div className="wa-welcome-intro">Choose a conversation, reconnect with someone, or open the General group when you are ready.</div>

                <div className="wa-home-profile">
                  <Avatar label={profile?.displayName || "Me"} src={profile?.avatarUrl} />
                  <div className="wa-home-profile-copy">
                    <div className="wa-home-profile-name">{profile?.displayName || "Your profile"}</div>
                    <div className="wa-home-profile-status">{profile?.profileStatus || "Available now"}</div>
                  </div>
                </div>

                <div className="wa-home-actions">
                  <button type="button" className="wa-home-action" onClick={() => { setSidebarMode("people"); setShowSidebar(true); }}>
                    <span className="wa-home-action-icon">✚</span>
                    New chat
                  </button>
                  <button type="button" className="wa-home-action" onClick={() => { setNewGroupName(""); setNewGroupMemberIds([]); setShowCreateGroup(true); }}>
                    <span className="wa-home-action-icon">👥</span>
                    New group
                  </button>
                  <button type="button" className="wa-home-action" onClick={() => {
                    const savedRoom = roomsSorted.find((room) => room.isSaved);
                    if (savedRoom) openHomeRoom(savedRoom.slug);
                  }}>
                    <span>⭐</span>
                    <strong>Saved Messages</strong>
                    <small>Keep notes, links and files for yourself</small>
                  </button>
                  <button type="button" className="wa-home-action" onClick={() => openHomeRoom("general")}>
                    <span className="wa-home-action-icon">💬</span>
                    Open General
                  </button>
                  <button type="button" className="wa-home-action" onClick={() => { setSidebarMode("chats"); setShowSidebar(true); }}>
                    <span className="wa-home-action-icon">🔍</span>
                    Find a chat
                  </button>
                </div>

                {unreadRooms.length ? (
                  <section className="wa-home-section">
                    <div className="wa-home-section-title">
                      <span>Unread conversations</span>
                      <span className="wa-home-count">{totalUnreadCount}</span>
                    </div>
                    <div className="wa-home-room-list">
                      {unreadRooms.map((room) => (
                        <button key={room.slug} type="button" className="wa-home-room" onClick={() => openHomeRoom(room.slug)}>
                          <Avatar label={getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(room)} />
                          <div className="wa-home-room-copy">
                            <div className="wa-home-room-name">{getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)}</div>
                            <div className="wa-home-room-preview">{room.lastMessageText || (room.slug === "general" ? "Public room" : "New conversation")}</div>
                          </div>
                          <span className="wa-home-room-unread">{unreadCounts[room.slug]}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="wa-home-section">
                  <div className="wa-home-section-title"><span>Recent chats</span></div>
                  {recentRooms.length ? (
                    <div className="wa-home-room-list">
                      {recentRooms.map((room) => (
                        <button key={room.slug} type="button" className="wa-home-room" onClick={() => openHomeRoom(room.slug)}>
                          <Avatar label={getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)} src={getRoomAvatarSrc(room)} />
                          <div className="wa-home-room-copy">
                            <div className="wa-home-room-name">{getRoomDisplayName(room, profile?.displayName, currentProfileId, profiles)}</div>
                            <div className="wa-home-room-preview">{room.lastMessageText || (room.slug === "general" ? "Public room" : "New conversation")}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : <div className="wa-home-empty">Your recent conversations will appear here.</div>}
                </section>
              </div>
            </main>
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
                  setProfileSaveError("");
                  setProfileAvatarFile(file);
                  setProfileAvatarPreview(file ? URL.createObjectURL(file) : (profile?.avatarUrl || ""));
                  e.target.value = "";
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
            {profileSaveError ? (
              <div className="wa-profile-save-error" role="alert">{profileSaveError}</div>
            ) : null}
            <div className="wa-modal-actions">
              <button
                type="button"
                className="wa-icon-btn"
                disabled={profileSavePending}
                onClick={() => {
                  setProfileSaveError("");
                  setShowProfileEditor(false);
                }}
              >Cancel</button>
              <button
                type="button"
                className="wa-send-btn"
                disabled={profileSavePending || !displayNameInput.trim()}
                onClick={handleSetName}
              >{profileSavePending ? "Saving…" : "Save"}</button>
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

      {desktopMessageActions?.message ? (
        <DesktopMessageContextMenu
          message={desktopMessageActions.message}
          mine={String(desktopMessageActions.message.senderProfileId || "") === String(currentProfileId || "")}
          isStarred={Array.isArray(desktopMessageActions.message.starredBy) && desktopMessageActions.message.starredBy.some((id) => String(id) === String(currentProfileId || ""))}
          isPinned={Boolean(desktopMessageActions.message.pinned)}
          position={desktopMessageActions.position}
          onClose={() => setDesktopMessageActions(null)}
          onReact={(emoji) => {
            if (emoji === "+") {
              openReactionPicker(desktopMessageActions.message, desktopMessageActions.position);
            } else {
              reactToMessage(desktopMessageActions.message._id, emoji);
            }
            setDesktopMessageActions(null);
          }}
          onReply={() => { setReplyTo(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onForward={() => { forwardMessage(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onToggleStar={() => { toggleStarMessage(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onTogglePin={() => { togglePinMessage(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onEdit={() => { editMessage(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onDeleteForMe={() => { deleteMessageForMe(desktopMessageActions.message); setDesktopMessageActions(null); }}
          onDeleteForEveryone={() => { deleteMessageForEveryone(desktopMessageActions.message); setDesktopMessageActions(null); }}
        />
      ) : null}

      {mobileMessageActions?.message ? (
        <MobileMessageActionSheet
          message={mobileMessageActions.message}
          mine={String(mobileMessageActions.message.senderProfileId || "") === String(currentProfileId || "")}
          isStarred={Array.isArray(mobileMessageActions.message.starredBy) && mobileMessageActions.message.starredBy.some((id) => String(id) === String(currentProfileId || ""))}
          isPinned={Boolean(mobileMessageActions.message.pinned)}
          onClose={() => setMobileMessageActions(null)}
          onReact={(emoji) => {
            reactToMessage(mobileMessageActions.message._id, emoji);
            setMobileMessageActions(null);
          }}
          onReply={() => { setReplyTo(mobileMessageActions.message); setMobileMessageActions(null); }}
          onForward={() => { forwardMessage(mobileMessageActions.message); setMobileMessageActions(null); }}
          onToggleStar={() => { toggleStarMessage(mobileMessageActions.message); setMobileMessageActions(null); }}
          onTogglePin={() => { togglePinMessage(mobileMessageActions.message); setMobileMessageActions(null); }}
          onEdit={() => { editMessage(mobileMessageActions.message); setMobileMessageActions(null); }}
          onDeleteForMe={() => { deleteMessageForMe(mobileMessageActions.message); setMobileMessageActions(null); }}
          onDeleteForEveryone={() => { deleteMessageForEveryone(mobileMessageActions.message); setMobileMessageActions(null); }}
        />
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
        <div className="wa-incoming-call-backdrop" role="presentation">
          <div className="wa-incoming-call" role="dialog" aria-modal="true" aria-label="Incoming call">
            <div className="wa-incoming-call-kind">
              {(incomingCall.callType || incomingCall.type) === "video" ? "Incoming video call" : "Incoming audio call"}
            </div>
            <Avatar
              label={incomingCall.name || "Caller"}
              src={getProfileAvatarById(incomingCall.profileId) || ""}
              className="incoming-call-avatar"
            />
            <div className="wa-incoming-title">
              {incomingCall.roomSlug === "general" ? "General" : (incomingCall.name || "Someone")}
            </div>
            <div className="wa-incoming-sub">
              {incomingCall.roomSlug === "general"
                ? `${incomingCall.name || "Someone"} started a call in General`
                : "Int-Messager call"}
            </div>
            <div className="wa-incoming-actions">
              <button type="button" className="wa-incoming-action decline" onClick={declineIncomingCall}>
                <span aria-hidden="true">✕</span>
                <small>Decline</small>
              </button>
              <button type="button" className="wa-incoming-action accept" onClick={() => joinCall(incomingCall.roomSlug)}>
                <span aria-hidden="true">📞︎</span>
                <small>Answer</small>
              </button>
            </div>
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
                <div className="wa-audio-call-pulse"><span className="wa-voice-call-icon" aria-hidden="true">📞︎</span></div>
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

            {Object.keys(remoteScreenStreams).length ? (
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
