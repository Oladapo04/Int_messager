import React, { useEffect, useState } from "react";
import { listSessions, revokeOtherSessions, revokeSession } from "../services/sessionService";

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
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
      <div className="wa-settings-title">Signed-in devices</div>
      <div className="wa-settings-note">Review and remove sessions you no longer recognise.</div>
      {error ? <div className="v45-inline-error">{error}</div> : null}
      {loading ? <div className="wa-settings-note">Loading devices…</div> : null}
      {!loading && sessions.length === 0 ? <div className="wa-settings-note">No active sessions found.</div> : null}
      <div className="v45-device-list">
        {sessions.map((item) => (
          <div key={item.sessionId} className="v45-device-row">
            <div>
              <strong>{item.deviceName || "Unknown device"}{item.current ? " · This device" : ""}</strong>
              <span>{item.browser || item.userAgent || "Unknown browser"}</span>
              <small>Last active: {formatDate(item.lastActiveAt)}</small>
            </div>
            {!item.current ? (
              <button type="button" className="wa-settings-btn v45-revoke-btn" disabled={busyId === item.sessionId} onClick={() => remove(item.sessionId)}>
                {busyId === item.sessionId ? "Removing…" : "Sign out"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {sessions.some((item) => !item.current) ? (
        <button type="button" className="wa-settings-btn v45-revoke-all" disabled={busyId === "others"} onClick={removeOthers}>
          {busyId === "others" ? "Signing out…" : "Sign out all other devices"}
        </button>
      ) : null}
    </div>
  );
}
