import React, { useEffect, useState } from "react";
import { listSessions, revokeOtherSessions, revokeSession } from "../services/sessionService";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deviceIcon(item) {
  const source = `${item?.deviceName || ""} ${item?.userAgent || ""}`.toLowerCase();
  if (/iphone|ipad|android|mobile/.test(source)) return "📱";
  if (/macintosh|mac os/.test(source)) return "💻";
  return "🖥️";
}

function browserLabel(item) {
  const raw = String(item?.browser || item?.userAgent || "").trim();
  const source = raw.toLowerCase();
  if (source.includes("edg/") || source.includes("microsoft edge")) return "Microsoft Edge";
  if (source.includes("firefox/")) return "Firefox";
  if (source.includes("chrome/") && !source.includes("edg/")) return "Google Chrome";
  if (source.includes("safari/") && !source.includes("chrome/")) return "Safari";
  if (raw && raw.length <= 44) return raw;
  return "Web browser";
}

function platformLabel(item) {
  const source = `${item?.deviceName || ""} ${item?.userAgent || ""}`.toLowerCase();
  if (/iphone|ipad|cpu iphone os|cpu os/.test(source)) return "iOS / iPadOS";
  if (/android/.test(source)) return "Android";
  if (/windows/.test(source)) return "Windows";
  if (/macintosh|mac os/.test(source)) return "macOS";
  return "Device";
}

export default function DeviceSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      setSessions(await listSessions());
    } catch (err) {
      setError(err.message || "Could not load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(sessionId) {
    try {
      setBusyId(sessionId);
      await revokeSession(sessionId);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not remove device");
    } finally { setBusyId(""); }
  }

  async function removeOthers() {
    try {
      setBusyId("others");
      await revokeOtherSessions();
      await refresh();
    } catch (err) {
      setError(err.message || "Could not sign out other devices");
    } finally { setBusyId(""); }
  }

  return (
    <div className="wa-settings-card v45-devices-card">
      <div className="v421-device-head">
        <div>
          <div className="wa-settings-title">Signed-in devices</div>
          <div className="wa-settings-note">Devices currently signed in to your Int-Messager account.</div>
        </div>
        <span className="v421-device-count">{sessions.length}</span>
      </div>

      {error ? <div className="v45-inline-error">{error}</div> : null}
      {loading ? <div className="wa-settings-note">Loading devices…</div> : null}
      {!loading && sessions.length === 0 ? <div className="wa-settings-note">No active sessions found.</div> : null}

      <div className="v45-device-list">
        {sessions.map((item) => (
          <div key={item.sessionId} className={`v45-device-row ${item.current ? "current" : ""}`}>
            <div className="v421-device-icon" aria-hidden="true">{deviceIcon(item)}</div>
            <div className="v421-device-copy">
              <div className="v421-device-title-row">
                <strong>{item.deviceName || platformLabel(item)}</strong>
                {item.current ? <span className="v421-current-badge">This device</span> : null}
              </div>
              <span>{browserLabel(item)} · {platformLabel(item)}</span>
              <small>Last active {formatDate(item.lastActiveAt)}</small>
            </div>
            {!item.current ? (
              <button type="button" className="v45-revoke-btn" disabled={busyId === item.sessionId} onClick={() => remove(item.sessionId)}>
                {busyId === item.sessionId ? "Signing out…" : "Sign out"}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {sessions.some((item) => !item.current) ? (
        <button type="button" className="v45-revoke-all" disabled={busyId === "others"} onClick={removeOthers}>
          {busyId === "others" ? "Signing out…" : "Sign out all other devices"}
        </button>
      ) : null}
    </div>
  );
}
