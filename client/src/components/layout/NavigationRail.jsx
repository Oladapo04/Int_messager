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
    { key: "chats", icon: "✉", label: "Chats" },
    { key: "people", icon: "◉", label: "Contacts" },
    { key: "calls", icon: "☎", label: "Calls" },
    { key: "settings", icon: "⚙", label: "Settings" },
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
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
            {item.key === "chats" && totalUnreadCount ? (
              <b>{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</b>
            ) : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="wa-rail-profile"
        title={`Edit ${profile?.displayName || "profile"}`}
        onClick={onEditProfile}
      >
        {avatar}
      </button>
    </nav>
  );
}
