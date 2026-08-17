import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";
import "../../styles/admin-dashboard-v490.css";
import "../../styles/admin-dashboard-v493.css";

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return withTime
    ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString([], { dateStyle: "medium" });
}

function initials(name = "") {
  const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function StatCard({ label, value, hint }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <small>{hint}</small>
    </article>
  );
}

function actionLabel(action = "") {
  const labels = {
    "account.suspended": "Account suspended",
    "account.reactivated": "Account reactivated",
    "password_reset.requested": "Password reset sent",
    "sessions.revoked": "Sessions revoked",
  };
  return labels[action] || String(action || "Admin action").replace(/[._-]+/g, " ");
}

function actionTone(action = "") {
  if (action === "account.suspended" || action === "sessions.revoked") return "danger";
  if (action === "account.reactivated") return "success";
  return "neutral";
}

export default function AdminDashboard({ open, onClose, appearance = "light" }) {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await apiFetch("/api/admin/dashboard");
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to load admin dashboard");
    setSummary(payload.data);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    params.set("limit", "100");
    const response = await apiFetch(`/api/admin/users?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to load users");
    setUsers(payload.data?.users || []);
  }, [query, status]);

  const loadAudit = useCallback(async () => {
    const response = await apiFetch("/api/admin/audit?limit=150");
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to load audit trail");
    setAuditEntries(payload.data?.entries || []);
  }, []);

  const loadSelectedUser = useCallback(async (id) => {
    if (!id) {
      setSelectedUser(null);
      return;
    }
    const response = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to load user details");
    setSelectedUser(payload.data);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadSummary(), loadUsers(), loadAudit()]);
      if (selectedId) await loadSelectedUser(selectedId);
    } catch (err) {
      setError(err?.message || "Failed to refresh admin data");
    } finally {
      setLoading(false);
    }
  }, [loadAudit, loadSelectedUser, loadSummary, loadUsers, selectedId]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      loadUsers().catch((err) => setError(err?.message || "Failed to search users"));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, loadUsers]);

  useEffect(() => {
    if (!selectedId) return;
    loadSelectedUser(selectedId).catch((err) => setError(err?.message || "Failed to load user details"));
  }, [loadSelectedUser, selectedId]);

  const selectedProfile = selectedUser?.profile || null;
  const activeUsers = useMemo(() => users.filter((user) => user.accountStatus !== "suspended").length, [users]);
  const maxTrend = useMemo(() => Math.max(1, ...(summary?.registrationTrend || []).map((item) => Number(item.count || 0))), [summary]);

  async function updateStatus(nextStatus) {
    if (!selectedProfile?._id) return;
    const verb = nextStatus === "suspended" ? "suspend" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${verb} ${selectedProfile.displayName || "this account"}?`)) return;
    setActionBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedProfile._id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || `Failed to ${verb} account`);
      setNotice(nextStatus === "suspended" ? "Account suspended and active sessions revoked." : "Account reactivated.");
      await refresh();
    } catch (err) {
      setError(err?.message || `Failed to ${verb} account`);
    } finally {
      setActionBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!selectedProfile?._id) return;
    if (!selectedProfile.email) {
      setError("This user does not have an email address, so a password reset link cannot be sent.");
      return;
    }
    if (!window.confirm(`Send a password reset link to ${selectedProfile.email}?`)) return;
    setActionBusy(true);
    setNotice("");
    setError("");
    setDevelopmentResetUrl("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedProfile._id)}/send-password-reset`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to send password reset");
      setNotice(payload.message || `Password reset instructions were sent to ${selectedProfile.email}.`);
      setDevelopmentResetUrl(payload.data?.developmentResetUrl || "");
      await loadAudit();
    } catch (err) {
      setError(err?.message || "Failed to send password reset");
    } finally {
      setActionBusy(false);
    }
  }

  async function copyDevelopmentResetLink() {
    if (!developmentResetUrl) return;
    try {
      await navigator.clipboard.writeText(developmentResetUrl);
      setNotice("Development reset link copied to clipboard.");
    } catch {
      window.prompt("Copy this reset link:", developmentResetUrl);
    }
  }

  async function revokeSessions() {
    if (!selectedProfile?._id) return;
    if (!window.confirm(`Sign ${selectedProfile.displayName || "this user"} out on every device?`)) return;
    setActionBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedProfile._id)}/revoke-sessions`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "Failed to revoke sessions");
      setNotice(`Active sessions revoked${Number.isFinite(payload.data?.revokedCount) ? ` (${payload.data.revokedCount})` : ""}.`);
      await refresh();
    } catch (err) {
      setError(err?.message || "Failed to revoke sessions");
    } finally {
      setActionBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-shell" data-appearance={appearance} role="dialog" aria-modal="true" aria-label="Int-Messager administration">
      <header className="admin-topbar">
        <div>
          <button type="button" className="admin-back" onClick={onClose}>← Back to Settings</button>
          <h1>Admin Dashboard</h1>
          <p>Users, sessions, activity and audit history</p>
        </div>
        <button type="button" className="admin-refresh" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </header>

      <div className="admin-scroll">
        {error ? <div className="admin-alert error">{error}</div> : null}
        {notice ? <div className="admin-alert success">{notice}</div> : null}

        <section className="admin-stats" aria-label="Account statistics">
          <StatCard label="Registered users" value={summary?.totalUsers} hint="Accounts with sign-in credentials" />
          <StatCard label="Online now" value={summary?.onlineNow} hint="Connected to Int-Messager now" />
          <StatCard label="Active today" value={summary?.activeToday} hint="Signed in or active today" />
          <StatCard label="New this week" value={summary?.newThisWeek} hint="Accounts created in the last 7 days" />
          <StatCard label="Suspended" value={summary?.suspendedUsers} hint={`${activeUsers} active in current results`} />
          <StatCard label="Admin actions" value={summary?.auditActionsThisWeek ?? 0} hint="Recorded in the last 7 days" />
        </section>

        <nav className="admin-view-tabs" aria-label="Administration sections">
          <button className={view === "users" ? "active" : ""} onClick={() => setView("users")} type="button">Users</button>
          <button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")} type="button">Activity</button>
          <button className={view === "audit" ? "active" : ""} onClick={() => setView("audit")} type="button">Audit trail</button>
        </nav>

        {view === "users" ? (
          <section className="admin-workspace">
            <div className="admin-users-panel">
              <div className="admin-section-heading"><div><h2>Users</h2><p>{users.length} account{users.length === 1 ? "" : "s"} shown</p></div></div>
              <div className="admin-filters">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone or username" />
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="admin-user-list">
                {users.map((user) => (
                  <button type="button" key={user._id} className={`admin-user-row ${selectedId === user._id ? "selected" : ""}`} onClick={() => { setSelectedId(user._id); setDevelopmentResetUrl(""); setNotice(""); setError(""); }}>
                    <span className="admin-user-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.displayName)}<i className={user.online ? "online" : ""} /></span>
                    <span className="admin-user-main"><strong>{user.displayName || "Unnamed user"}</strong><small>{user.email || user.phone || user.username || "No contact identifier"}</small></span>
                    <span className={`admin-status-pill ${user.accountStatus === "suspended" ? "suspended" : user.online ? "online" : ""}`}>{user.accountStatus === "suspended" ? "Suspended" : user.online ? "Online" : "Active"}</span>
                    <span className="admin-user-date">{formatDate(user.lastActiveAt || user.lastLoginAt, true)}</span>
                  </button>
                ))}
                {!users.length && !loading ? <div className="admin-empty">No users match this search.</div> : null}
              </div>
            </div>

            <aside className={`admin-user-detail ${selectedProfile ? "open" : ""}`}>
              {selectedProfile ? (
                <>
                  <div className="admin-detail-profile">
                    <span className="admin-detail-avatar">{selectedProfile.avatarUrl ? <img src={selectedProfile.avatarUrl} alt="" /> : initials(selectedProfile.displayName)}</span>
                    <div><h2>{selectedProfile.displayName || "Unnamed user"}</h2><p>{selectedProfile.profileStatus || "No profile status"}</p><span className={`admin-status-pill ${selectedProfile.accountStatus === "suspended" ? "suspended" : selectedUser.online ? "online" : ""}`}>{selectedProfile.accountStatus === "suspended" ? "Suspended" : selectedUser.online ? "Online now" : "Active account"}</span></div>
                    <button type="button" className="admin-detail-close" onClick={() => { setSelectedId(""); setSelectedUser(null); }}>×</button>
                  </div>
                  <div className="admin-detail-grid">
                    <div><span>Email</span><strong>{selectedProfile.email || "—"}</strong></div><div><span>Phone</span><strong>{selectedProfile.phone || "—"}</strong></div>
                    <div><span>Username</span><strong>{selectedProfile.username ? `@${selectedProfile.username}` : "—"}</strong></div><div><span>Role</span><strong>{selectedProfile.role || "user"}</strong></div>
                    <div><span>Joined</span><strong>{formatDate(selectedProfile.createdAt, true)}</strong></div><div><span>Last login</span><strong>{formatDate(selectedProfile.lastLoginAt, true)}</strong></div>
                    <div><span>Last active</span><strong>{formatDate(selectedUser.lastActiveAt, true)}</strong></div><div><span>Active devices</span><strong>{selectedUser.activeSessionCount ?? 0}</strong></div>
                    <div><span>Messages sent</span><strong>{selectedUser.messageCount ?? 0}</strong></div><div><span>Calls recorded</span><strong>{selectedUser.callCount ?? 0}</strong></div>
                  </div>
                  <section className="admin-device-section"><h3>Active sessions</h3>{selectedUser.sessions?.length ? selectedUser.sessions.map((session) => <div className="admin-device-row" key={session.sessionId}><div><strong>{session.deviceName || "Device"}</strong><small>{session.browser || "Browser session"}</small></div><span>{formatDate(session.lastActiveAt, true)}</span></div>) : <div className="admin-empty compact">No active sessions.</div>}</section>
                  <section className="admin-security-section"><div className="admin-security-heading"><div><h3>Security</h3><p>Reset access without viewing or choosing the user&apos;s password.</p></div></div><div className="admin-security-card"><div><strong>Password reset</strong><span>{selectedProfile.email ? `Send a secure, time-limited reset link to ${selectedProfile.email}.` : "This account has no email address, so email password reset is unavailable."}</span></div><button type="button" className="admin-reset-password-btn" onClick={sendPasswordReset} disabled={actionBusy || !selectedProfile.email}>{actionBusy ? "Please wait…" : "Send password reset"}</button></div>{developmentResetUrl ? <div className="admin-dev-reset"><strong>Development reset link</strong><p>Email delivery is not configured, so use this link for local testing. Do not expose it publicly.</p><div className="admin-dev-reset-row"><input value={developmentResetUrl} readOnly aria-label="Development password reset link" /><button type="button" onClick={copyDevelopmentResetLink}>Copy</button></div></div> : null}</section>
                  <section className="admin-management-section"><h3>Account controls</h3><div className="admin-account-actions"><button type="button" onClick={revokeSessions} disabled={actionBusy}>Sign out all devices</button>{selectedProfile.accountStatus === "suspended" ? <button type="button" className="success" onClick={() => updateStatus("active")} disabled={actionBusy}>Reactivate account</button> : <button type="button" className="danger" onClick={() => updateStatus("suspended")} disabled={actionBusy || selectedProfile.role === "admin"}>Suspend account</button>}</div>{selectedProfile.role === "admin" ? <p className="admin-protection-note">Admin accounts cannot be suspended from this screen.</p> : null}</section>
                </>
              ) : <div className="admin-detail-placeholder"><strong>Select a user</strong><span>Account details and controls will appear here.</span></div>}
            </aside>
          </section>
        ) : null}

        {view === "activity" ? (
          <section className="admin-activity-grid">
            <article className="admin-insight-card">
              <div className="admin-insight-head"><div><h2>Registrations</h2><p>New accounts over the last 7 days</p></div><strong>{summary?.newThisWeek ?? 0}</strong></div>
              <div className="admin-trend-bars">
                {(summary?.registrationTrend || []).map((item) => {
                  const date = new Date(`${item.date}T00:00:00`);
                  const height = Math.max(6, Math.round((Number(item.count || 0) / maxTrend) * 100));
                  return <div className="admin-trend-day" key={item.date}><span className="admin-trend-bar-wrap"><i style={{ height: `${height}%` }} /></span><strong>{item.count}</strong><small>{date.toLocaleDateString([], { weekday: "short" })}</small></div>;
                })}
              </div>
            </article>
            <article className="admin-insight-card admin-recent-session-card">
              <div className="admin-insight-head"><div><h2>Recent session activity</h2><p>Device/session metadata only</p></div></div>
              <div className="admin-session-feed">
                {(summary?.recentSessions || []).map((session, index) => <div className="admin-session-item" key={`${session.sessionId || session.profileId}-${index}`}><span className="admin-feed-avatar">{initials(session.displayName)}</span><div><strong>{session.displayName || "User"}</strong><small>{session.deviceName || "Device"}{session.browser ? ` · ${session.browser}` : ""}</small></div><time>{formatDate(session.lastActiveAt, true)}</time></div>)}
                {!summary?.recentSessions?.length ? <div className="admin-empty compact">No recent session activity.</div> : null}
              </div>
            </article>
          </section>
        ) : null}

        {view === "audit" ? (
          <section className="admin-audit-panel">
            <div className="admin-section-heading"><div><h2>Audit trail</h2><p>Administrator actions only. Private message content is never included.</p></div><span>{auditEntries.length} recent</span></div>
            <div className="admin-audit-list">
              {auditEntries.map((entry) => <article className="admin-audit-row" key={entry._id}><span className={`admin-audit-icon ${actionTone(entry.action)}`}>{entry.action === "account.suspended" ? "!" : entry.action === "account.reactivated" ? "✓" : entry.action === "sessions.revoked" ? "↪" : "↗"}</span><div className="admin-audit-main"><strong>{actionLabel(entry.action)}</strong><p><b>{entry.actorName || "Administrator"}</b>{entry.targetName ? <> → {entry.targetName}</> : null}</p><small>{entry.targetEmail || entry.actorEmail || ""}</small></div><div className="admin-audit-meta"><time>{formatDate(entry.createdAt, true)}</time>{entry.details?.revokedCount !== undefined ? <span>{entry.details.revokedCount} session{entry.details.revokedCount === 1 ? "" : "s"}</span> : null}{entry.details?.delivered !== undefined ? <span>{entry.details.delivered ? "Email delivered" : "Reset generated"}</span> : null}</div></article>)}
              {!auditEntries.length && !loading ? <div className="admin-empty">No administrator actions have been recorded yet.</div> : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
