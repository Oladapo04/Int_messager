function RailIcon({ type }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "chats") return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A8.5 8.5 0 1 1 21 15Z" /></svg>;
  if (type === "people") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (type === "updates") return <svg {...common}><path d="M21 12a9 9 0 0 1-9 9"/><path d="M3 12a9 9 0 0 1 9-9"/><path d="M12 3a9 9 0 0 1 7.8 4.5"/><path d="M12 21a9 9 0 0 1-7.8-4.5"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (type === "calls") return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.08-.4H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.6a1.65 1.65 0 0 0 1-.6A1.65 1.65 0 0 0 9.4 1.92V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 3.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.36.36.68.65.92.29.24.65.38 1.03.4H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/></svg>;
}

export default function NavigationRail({
  sidebarMode,
  totalUnreadCount,
  profile,
  avatar,
  onHome,
  onModeChange,
  onEditProfile,
}) {
  const navigation = [
    { key: "chats", label: "Chats" },
    { key: "people", label: "Contacts" },
    { key: "updates", label: "Updates" },
    { key: "calls", label: "Calls" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <nav className="wa-nav-rail" aria-label="Main navigation">
      <button type="button" className="wa-rail-logo" title="Home" onClick={onHome}>
        <img src="/icons/icon-192.png" alt="Int-Messager" />
      </button>

      <div className="wa-rail-nav">
        {navigation.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`wa-rail-btn ${sidebarMode === item.key ? "active" : ""}`}
            onClick={() => onModeChange(item.key)}
            title={item.label}
            aria-current={sidebarMode === item.key ? "page" : undefined}
          >
            <span className="wa-rail-icon"><RailIcon type={item.key} /></span>
            <small>{item.label}</small>
            {item.key === "chats" && totalUnreadCount ? <b>{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</b> : null}
          </button>
        ))}
      </div>

      <button type="button" className="wa-rail-profile" title={`Edit ${profile?.displayName || "profile"}`} onClick={onEditProfile}>
        {avatar}
      </button>
    </nav>
  );
}
